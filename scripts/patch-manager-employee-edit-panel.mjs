import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
const source = readFileSync(file, "utf8");
const markers = [
  'fixed inset-y-0 right-0 z-[70] w-full max-w-2xl',
  'fixed top-[138px] bottom-0 right-0 z-[70] w-full max-w-2xl manager-employee-editor',
];
const to = 'fixed top-0 bottom-0 right-0 z-[70] w-full max-w-2xl manager-employee-editor';
const from = markers.find((marker) => source.includes(marker));

if (!from) {
  throw new Error("Manager employee edit panel marker not found.");
}

const updated = source.replace(from, to);
if (updated !== source) writeFileSync(file, updated, "utf8");
