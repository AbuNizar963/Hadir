import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/recovery.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const oldFn = `async function readCompanySettings(env: Env) {
  await ensureRecoveryTables(env.DB);
  const rows = await env.DB.prepare("SELECT key,value FROM settings").all<{ key: string; value: string }>();`;
const newFn = `async function readCompanySettings(env: Env, request?: Request) {
  await ensureRecoveryTables(env.DB);
  const rows = await env.DB.prepare("SELECT key,value FROM settings").all<{ key: string; value: string }>();`;
if (source.includes(oldFn)) source = source.replace(oldFn, newFn);

const oldReturn = `  return { ...settings, adminAccounts: admins.results || [], locations: locations.results || [] };
}

async function saveCompanySettings(req: Request, env: Env, origin: string) {`;
const newReturn = `  // D1 stores the R2 pointer, but the R2 object itself is authoritative for the
  // current logo. Resolve its ETag here so a browser never receives a stale
  // cacheable URL after a logo replacement (including after a D1 outage).
  if (request && env.PROFILE_IMAGES) {
    try {
      const logoKeyRow = await env.DB.prepare("SELECT value FROM settings WHERE key='brandLogoR2Key' LIMIT 1").first<{ value: string }>();
      const configuredKey = String(logoKeyRow?.value || "").trim() || "company/logo-current.webp";
      const object = await env.PROFILE_IMAGES.head(configuredKey);
      if (object) {
        const logoUrl = new URL(request.url);
        logoUrl.pathname = "/api/company/logo";
        logoUrl.search = `?v=${encodeURIComponent(object.etag)}`;
        settings.brandLogo = logoUrl.toString();
      }
    } catch {
      // Keep the D1 value if R2 metadata cannot be read during this request.
    }
  }
  return { ...settings, adminAccounts: admins.results || [], locations: locations.results || [] };
}

async function saveCompanySettings(req: Request, env: Env, origin: string) {`;
if (source.includes(oldReturn)) source = source.replace(oldReturn, newReturn);

const oldGet = `  if (req.method === "GET") return json(await readCompanySettings(env), 200, origin);`;
const newGet = `  if (req.method === "GET") return json(await readCompanySettings(env, req), 200, origin);`;
if (source.includes(oldGet)) source = source.replace(oldGet, newGet);

if (!source.includes("readCompanySettings(env, req)")) {
  throw new Error("Company logo settings read patch: GET anchor not found; refusing unsafe replacement.");
}
if (!source.includes("settings.brandLogo = logoUrl.toString();")) {
  throw new Error("Company logo settings read patch: R2 ETag URL anchor not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("Company logo settings read patch: /api/settings now resolves the current R2 ETag into brandLogo.");
