type Env = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };

type ResetResult = {
  deleted: Record<string, number>;
  preserved: string[];
  r2Deleted: number;
};

const PROTECTED_TABLES = new Set(["admin_accounts", "employees", "d1_migrations"]);

function safeTableName(value: unknown): string | null {
  const name = String(value || "").trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null;
}

export async function resetTestData(env: Env): Promise<ResetResult> {
  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all<{ name: string }>();

  const allTables = (tables.results || [])
    .map((row) => safeTableName(row.name))
    .filter((name): name is string => Boolean(name));
  const preserved = allTables.filter((name) => PROTECTED_TABLES.has(name));

  // Keep employee identity/login data, but clear all operational/configuration
  // state so the new attendance system starts from a clean slate.
  const employeeCount = Number((await env.DB.prepare("SELECT COUNT(*) AS count FROM employees").first<any>())?.count || 0);

  // D1 enforces foreign keys; deferring them lets the complete cleanup happen
  // atomically even when a newly added module references employees.
  const targets = allTables.filter((name) => !PROTECTED_TABLES.has(name));
  const statements = [env.DB.prepare("PRAGMA defer_foreign_keys = ON")];
  for (const table of targets) statements.push(env.DB.prepare(`DELETE FROM "${table}"`));
  statements.push(env.DB.prepare("PRAGMA defer_foreign_keys = OFF"));
  const results = await env.DB.batch(statements);

  const deleted: Record<string, number> = {};
  targets.forEach((table, index) => {
    const changes = Number((results[index + 1] as any)?.meta?.changes || 0);
    deleted[table] = Number.isFinite(changes) ? changes : 0;
  });

  // Preserve only employee account/profile essentials. Schedule, device,
  // rotation, grace, location, and other experimental configuration is reset.
  const resetEmployees = await env.DB.prepare(`
    UPDATE employees SET
      status='active',
      device_id=NULL,
      device_label=NULL,
      schedule_type='ADMIN',
      rotation_start_date=NULL,
      work_start_time=NULL,
      work_end_time=NULL,
      grace_period_minutes=10,
      role='staff',
      location_id=NULL,
      rotation_days_on=NULL,
      rotation_days_off=NULL,
      specialties_json='[]',
      work_days_json='[]'
  `).run();
  deleted.employees_reset = Number((resetEmployees.meta as any)?.changes || employeeCount);

  // Profile images are explicitly preserved. Their employee avatar references
  // remain intact, so no R2 object is deleted during a test-data reset.
  return { deleted, preserved, r2Deleted: 0 };
}
