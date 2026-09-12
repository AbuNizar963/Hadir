type Env = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };

type ResetResult = {
  deleted: Record<string, number>;
  preserved: string[];
  r2Deleted: number;
};

// A test-data reset must not change employee identities, credentials,
// profile images, or the work configuration that was explicitly requested
// to remain intact. Only transactional/test/runtime data is cleared.
const PROTECTED_TABLES = new Set([
  "admin_accounts",
  "employees",
  "employee_passkeys",
  "employee_webauthn_credentials",
  "employee_checkout_policies",
  "settings",
  "locations",
  "d1_migrations",
]);

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

  // Cloudflare/internal tables (for example _cf_KV) are not application data
  // and must never be touched by this reset.
  const targets = allTables.filter(
    (name) => !PROTECTED_TABLES.has(name) && !name.startsWith("_cf_")
  );
  const statements = [env.DB.prepare("PRAGMA defer_foreign_keys = ON")];
  for (const table of targets) statements.push(env.DB.prepare(`DELETE FROM "${table}"`));
  statements.push(env.DB.prepare("PRAGMA defer_foreign_keys = OFF"));

  const results = await env.DB.batch(statements);
  const deleted: Record<string, number> = {};
  targets.forEach((table, index) => {
    const changes = Number((results[index + 1] as any)?.meta?.changes || 0);
    deleted[table] = Number.isFinite(changes) ? changes : 0;
  });

  // Profile images are intentionally preserved. Employee rows remain intact,
  // so their existing R2 object keys continue to work after the reset.
  return { deleted, preserved, r2Deleted: 0 };
}
