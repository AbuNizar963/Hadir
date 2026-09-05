import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
const source = readFileSync(file, "utf8");
const from = 'fixed inset-y-0 right-0 z-[70] w-full max-w-2xl';
const to = 'fixed inset-0 z-[100] w-full overflow-y-auto rounded-none border-0 bg-background';

if (!source.includes(from)) {
  throw new Error("Manager employee edit panel marker not found.");
}

const updated = source.replace(from, to);
if (updated !== source) writeFileSync(file, updated, "utf8");
