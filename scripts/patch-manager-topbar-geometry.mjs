import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/components/layout/ManagerLayout.tsx", import.meta.url);
const source = readFileSync(file, "utf8");
const from = 'const sync = () => { document.documentElement.style.setProperty("--hadir-manager-topbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`); };';
const to = 'const sync = () => { const rect = el.getBoundingClientRect(); document.documentElement.style.setProperty("--hadir-manager-topbar-h", `${Math.max(0, Math.ceil(rect.bottom))}px`); };';
if (!source.includes(from)) throw new Error("Manager topbar geometry marker not found.");
const updated = source.replace(from, to);
if (updated !== source) writeFileSync(file, updated, "utf8");
console.log("ManagerLayout geometry patch: overlays now anchor to the actual topbar bottom edge.");
