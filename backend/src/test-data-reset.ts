type Env = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };

type ResetResult = {
  deleted: Record<string, number>;
  preserved: string[];
  r2Deleted: number;
};

const PROTECTED_TABLES = new Set(["admin_accounts", "settings", "locations", "d1_migrations"]);

function safeTableName(value: unknown): string | null {
  const name = String(value || "").trim();
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null;
}

async function emptyProfileImages(bucket: R2Bucket | undefined): Promise<number> {
  if (!bucket) return 0;
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function resetTestData(env: Env): Promise<ResetResult> {
  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all<{ name: string }>();

  const allTables = (tables.results || [])
    .map((row) => safeTableName(row.name))
    .filter((name): name is string => Boolean(name));
  const preserved = allTables.filter((name) => PROTECTED_TABLES.has(name));

  // Delete every application-data table while keeping the administrative
  // accounts, system settings, and configured work locations intact.
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

  const r2Deleted = await emptyProfileImages(env.PROFILE_IMAGES);
  return { deleted, preserved, r2Deleted };
}
