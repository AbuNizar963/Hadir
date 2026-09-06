import { readFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
const source = readFileSync(file, "utf8");

// This script is intentionally non-destructive. ManagerReports currently contains
// the production-safe incomplete-session handling directly in the source. The
// previous text-replacement patch depended on stale anchors and could abort the
// production build when the surrounding code changed. Never rewrite the report
// from an outdated textual snapshot during a build.
if (!source.includes('else st = "open";')) {
  throw new Error("ManagerReports: expected attendance status logic was not found.");
}

console.log("ManagerReports final patch: source validated; no textual rewrite required.");
