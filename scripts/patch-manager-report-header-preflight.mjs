import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";

if (!existsSync(file)) {
  throw new Error("ManagerReports header preflight: source file not found.");
}

let source = readFileSync(file, "utf8");
const desired = "@page { size: A4 portrait; margin: 8mm 7mm; }";

if (source.includes(desired)) {
  console.log("ManagerReports header preflight: @page rule already normalized.");
  process.exit(0);
}

const pageRule = /@page\s*\{[^}]*\}/;
if (pageRule.test(source)) {
  const nextSource = source.replace(pageRule, desired);
  if (nextSource !== source) writeFileSync(file, nextSource, "utf8");
  console.log("ManagerReports header preflight: normalized existing @page rule.");
  process.exit(0);
}

const sectionAnchor = /<section\s+className=[\"']service-report\b[^\"']*[\"'][^>]*>/;
const match = source.match(sectionAnchor);
if (!match || match.index === undefined) {
  throw new Error("ManagerReports header preflight: service report section anchor not found.");
}

const insertion = "<style>{`" + desired + "`}</style>";
const nextSource = source.slice(0, match.index) + insertion + source.slice(match.index);
writeFileSync(file, nextSource, "utf8");
console.log("ManagerReports header preflight: inserted normalized @page rule.");
