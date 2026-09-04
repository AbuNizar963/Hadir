import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/company-logo.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `    const key = CURRENT_LOGO_KEY;\n    const publicUrl = logoUrl(req, key);\n    const bytes = new Uint8Array(await file.arrayBuffer());\n\n    await env.PROFILE_IMAGES.put(key, bytes, {`;

const newBlock = `    const key = CURRENT_LOGO_KEY;\n    const bytes = new Uint8Array(await file.arrayBuffer());\n\n    await env.PROFILE_IMAGES.put(key, bytes, {`;

if (source.includes("const encodedVersion = encodeURIComponent(storedObject.httpEtag);")) {
  console.log("Company logo cache-version patch: upload cache-version block already applied.");
} else {
  if (!source.includes(oldBlock)) {
    throw new Error("Company logo cache-version patch: upload anchor not found; refusing unsafe replacement.");
  }

  source = source.replace(oldBlock, newBlock);
  const headAnchor = `    if (!storedObject) {\n      console.error("company logo R2 persistence verification failed", key);\n      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    try {`;
  const headReplacement = `    if (!storedObject) {\n      console.error("company logo R2 persistence verification failed", key);\n      return json({ error: "تعذر التحقق من حفظ شعار الشركة في R2" }, 502, origin);\n    }\n\n    // The R2 key intentionally stays stable, but the public URL gets the\n    // object's ETag so browsers immediately display a newly uploaded logo\n    // instead of serving a previously cached image.\n    const encodedVersion = encodeURIComponent(storedObject.httpEtag);\n    const publicUrl = logoUrl(req, encodedVersion);\n\n    try {`;
  if (!source.includes(headAnchor)) {
    throw new Error("Company logo cache-version patch: R2 verification anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(headAnchor, headReplacement);
}

const oldGetBlock = `    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();\n    const configuredKey = String(row?.value || "").trim();\n    const keys = configuredKey && configuredKey !== CURRENT_LOGO_KEY ? [configuredKey, CURRENT_LOGO_KEY] : [CURRENT_LOGO_KEY];`;
const newGetBlock = `    // R2 is authoritative for the current logo. Always try the canonical\n    // current object first so a stale/legacy D1 key can never resurrect the old logo.\n    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();\n    const configuredKey = String(row?.value || "").trim();\n    const keys = Array.from(new Set([CURRENT_LOGO_KEY, configuredKey].filter(Boolean)));`;

if (source.includes("const keys = Array.from(new Set([CURRENT_LOGO_KEY, configuredKey].filter(Boolean)));")) {
  console.log("Company logo cache-version patch: GET already prefers canonical R2 key.");
} else if (source.includes("const object = await env.PROFILE_IMAGES.get(CURRENT_LOGO_KEY);")) {
  // A newer implementation already made R2 canonical and no GET patch is needed.
  console.log("Company logo cache-version patch: GET already reads the canonical R2 object directly.");
} else {
  if (!source.includes(oldGetBlock)) {
    throw new Error("Company logo cache-version patch: GET logo-key anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(oldGetBlock, newGetBlock);
}

const oldDeleteBlock = `  if (req.method === "DELETE") {\n    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();\n    const key = String(row?.value || "").trim();\n    if (key) await env.PROFILE_IMAGES.delete(key).catch(() => undefined);\n    if (key !== CURRENT_LOGO_KEY) await env.PROFILE_IMAGES.delete(CURRENT_LOGO_KEY).catch(() => undefined);\n    await env.DB.batch([\n      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_KEY_SETTING),\n      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_URL_SETTING),\n      env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_BACKUP_SETTING),\n    ]);\n    return json({ ok: true }, 200, origin);\n  }`;
const newDeleteBlock = `  if (req.method === "DELETE") {\n    // R2 is authoritative for the current logo. Delete the canonical object\n    // regardless of a stale D1 pointer, and treat D1 cleanup as best-effort so\n    // a temporary D1 write limit can never surface as a fake network failure.\n    const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(LOGO_KEY_SETTING).first<{ value: string }>();\n    const key = String(row?.value || "").trim();\n    await env.PROFILE_IMAGES.delete(CURRENT_LOGO_KEY).catch((error) => console.error("company logo canonical R2 delete failed", error));\n    if (key && key !== CURRENT_LOGO_KEY) await env.PROFILE_IMAGES.delete(key).catch((error) => console.error("company logo legacy R2 delete failed", error));\n    try {\n      await env.DB.batch([\n        env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_KEY_SETTING),\n        env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_URL_SETTING),\n        env.DB.prepare("DELETE FROM settings WHERE key=?").bind(LOGO_BACKUP_SETTING),\n      ]);\n    } catch (error) {\n      console.error("company logo D1 cleanup failed; R2 logo was still deleted", error);\n    }\n    return json({ ok: true, r2Deleted: true, settingsCleaned: true }, 200, origin);\n  }`;

if (source.includes("settingsCleaned: true")) {
  console.log("Company logo cache-version patch: DELETE already tolerates D1 cleanup failures.");
} else {
  if (!source.includes(oldDeleteBlock)) {
    throw new Error("Company logo cache-version patch: DELETE anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(oldDeleteBlock, newDeleteBlock);
}

writeFileSync(file, source, "utf8");
console.log("Company logo cache-version patch: upload URLs are ETag-versioned, GET uses the canonical current R2 object, and DELETE tolerates D1 write limits.");
