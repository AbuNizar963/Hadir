import { readFile, readdir } from "node:fs/promises";

const files = [
  "src/lib/auth.ts",
  "src/lib/storage.ts",
  "src/lib/backend.ts",
  "backend/src/ai-entry.ts",
  "backend/src/entry.ts",
  "backend/src/secureApp.ts",
  "backend/wrangler.jsonc",
];
const text = Object.fromEntries(
  await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]))
);

const forbidden = ["963963963", "DEFAULT_OWNER_PASSWORD", "DEFAULT_OWNER_USERNAME"];
for (const file of ["src/lib/auth.ts", "src/lib/storage.ts"]) {
  for (const value of forbidden) {
    if (text[file].includes(value)) {
      throw new Error(`${file}: forbidden legacy credential marker ${value}`);
    }
  }
}

if (!text["backend/src/ai-entry.ts"].includes("HttpOnly")) {
  throw new Error("backend/src/ai-entry.ts: session cookie must be HttpOnly");
}
if (!text["backend/src/ai-entry.ts"].includes("SameSite=None; Secure; HttpOnly")) {
  throw new Error(
    "backend/src/ai-entry.ts: cross-site session cookie must use SameSite=None; Secure; HttpOnly"
  );
}
if (!text["backend/src/ai-entry.ts"].includes("delete data.token")) {
  throw new Error(
    "backend/src/ai-entry.ts: authentication responses must not expose session tokens to browser JavaScript"
  );
}
if (!text["backend/src/secureApp.ts"].includes("const { token: _token, ...safeData }")) {
  throw new Error("backend/src/secureApp.ts: auth response token stripping is missing");
}
if (!text["backend/src/entry.ts"].includes("sanitizeAuthResponse")) {
  throw new Error(
    "backend/src/entry.ts: login responses must be sanitized before reaching the browser"
  );
}
if (!text["src/lib/backend.ts"].includes('credentials: "include"')) {
  throw new Error("src/lib/backend.ts: API requests must include cookies");
}
if (
  text["src/lib/backend.ts"].includes("localStorage.getItem") ||
  text["src/lib/backend.ts"].includes("localStorage.setItem") ||
  text["src/lib/backend.ts"].includes("localStorage.removeItem")
) {
  throw new Error("src/lib/backend.ts: authentication state must not use localStorage");
}
if (!text["backend/src/entry.ts"].includes("access-control-allow-credentials")) {
  throw new Error("backend/src/entry.ts: credentialed CORS support is missing");
}
if (text["backend/wrangler.jsonc"].includes('"APP_ORIGIN": "*"')) {
  throw new Error("backend/wrangler.jsonc: wildcard APP_ORIGIN is forbidden");
}

const migrationDir = "backend/migrations";
const names = (await readdir(migrationDir)).filter((name) => /^\d+_.+\.sql$/.test(name));
const groups = new Map();
for (const name of names) {
  const prefix = name.match(/^\d+/)[0];
  const list = groups.get(prefix) || [];
  list.push(name);
  groups.set(prefix, list);
}
const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);
if (duplicates.length) {
  console.warn("Migration numbering contains historical duplicate prefixes:");
  for (const [prefix, list] of duplicates) {
    console.warn(`  ${prefix}: ${list.join(", ")}`);
  }
  console.warn(
    "These are intentionally not renamed automatically because already-applied D1 migrations must not be rewritten."
  );
}

console.log("Security regression audit passed.");
