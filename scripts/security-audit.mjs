import { readFile, readdir } from "node:fs/promises";

const files = ["src/lib/auth.ts", "src/lib/storage.ts"];
const forbidden = ["963963963", "DEFAULT_OWNER_PASSWORD", "DEFAULT_OWNER_USERNAME"];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const value of forbidden) {
    if (text.includes(value)) throw new Error(`${file}: forbidden legacy credential marker ${value}`);
  }
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
  for (const [prefix, list] of duplicates) console.warn(`  ${prefix}: ${list.join(", ")}`);
  console.warn("These are intentionally not renamed automatically because already-applied D1 migrations must not be rewritten.");
}
console.log("Security regression audit passed.");
