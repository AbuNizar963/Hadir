import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) throw new Error("ManagerReports header preflight: source file not found.");
let source = readFileSync(file, "utf8");

const desired = "@page { size: A4 portrait; margin: 8mm 7mm; }";
if (!source.includes(desired)) {
  const pageRule = /@page\s*\{[^}]*\}/;
  if (!pageRule.test(source)) throw new Error("ManagerReports header preflight: @page rule not found.");
  source = source.replace(pageRule, desired);
  writeFileSync(file, source, "utf8");
  console.log("ManagerReports header preflight: normalized @page rule.");
} else {
  console.log("ManagerReports header preflight: @page rule already normalized.");
}
