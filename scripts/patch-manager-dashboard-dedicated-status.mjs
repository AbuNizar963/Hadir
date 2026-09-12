import { readFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerDashboard.tsx", import.meta.url);
const source = readFileSync(file, "utf8");

// ManagerDashboard is maintained as source-of-truth code. Keep this build step
// idempotent so a migrated dashboard does not fail on a legacy import anchor.
const requiredMarkers = [
  'type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave" | "permission" | "escaped";',
  'case "OPEN": return "دوام مفتوح";',
  'case "PERMISSION": return "إذن";',
];

const missing = requiredMarkers.filter((marker) => !source.includes(marker));
if (missing.length > 0) {
  throw new Error(`ManagerDashboard dedicated status patch: canonical dashboard markers missing (${missing.length}); refusing unsafe replacement.`);
}

console.log("ManagerDashboard dedicated status patch: canonical source already present; no rewrite required.");
