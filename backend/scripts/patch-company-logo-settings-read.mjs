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
const newReturn = [
  `  // R2 is authoritative for the current company logo. Prefer the canonical`,
  `  // current key even if D1 still points at a legacy key (for example after a`,
  `  // temporary D1 write-limit). This guarantees a reload cannot resurrect an`,
  `  // older logo while the verified current object already exists in R2.`,
  `  if (request && env.PROFILE_IMAGES) {`,
  `    try {`,
  `      const logoKeyRow = await env.DB.prepare("SELECT value FROM settings WHERE key='brandLogoR2Key' LIMIT 1").first<{ value: string }>();`,
  `      const configuredKey = String(logoKeyRow?.value || "").trim();`,
  `      const candidateKeys = Array.from(new Set(["company/logo-current.webp", configuredKey].filter(Boolean)));`,
  `      for (const key of candidateKeys) {`,
  `        const object = await env.PROFILE_IMAGES.head(key);`,
  `        if (!object) continue;`,
  `        const logoUrl = new URL(request.url);`,
  `        logoUrl.pathname = "/api/company/logo";`,
  `        logoUrl.search = "?v=" + encodeURIComponent(object.etag);`,
  `        settings.brandLogo = logoUrl.toString();`,
  `        break;`,
  `      }`,
  `    } catch {`,
  `      // Keep the D1 value if R2 metadata cannot be read during this request.`,
  `    }`,
  `  }`,
  `  return { ...settings, adminAccounts: admins.results || [], locations: locations.results || [] };`,
  `}`,
  ``,
  `async function saveCompanySettings(req: Request, env: Env, origin: string) {`,
].join("\n");
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
if (!source.includes("candidateKeys = Array.from(new Set([\"company/logo-current.webp\", configuredKey]")) && !source.includes("const candidateKeys = Array.from(new Set([\"company/logo-current.webp\", configuredKey]")) ) {
  throw new Error("Company logo settings read patch: canonical R2 key preference anchor not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("Company logo settings read patch: /api/settings now resolves the canonical current R2 logo first and versions it by ETag.");
