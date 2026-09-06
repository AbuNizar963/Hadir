import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/ManagerReports.tsx";
if (!existsSync(file)) throw new Error("ManagerReports header preflight: source file not found.");
let source = readFileSync(file, "utf8");

const desired = "@page { size: A4 portrait; margin: 8mm 7mm; }";
if (!source.includes(desired)) {
  const pageRule = /@page\s*\{[^}]*\}/;
  if (pageRule.test(source)) {
    source = source.replace(pageRule, desired);
  } else {
    const sectionAnchor = '<section className="service-report bg-white text-black rounded-none border shadow-sm print:border-0 print:shadow-none" dir="rtl">';
    if (!source.includes(sectionAnchor)) throw new Error("ManagerReports header preflight: service report section anchor not found.");
    source = source.replace(sectionAnchor, `<style>{\`${desired}\`}</style>${sectionAnchor}`);
  }
  writeFileSync(file, source, "utf8");
  console.log("ManagerReports header preflight: normalized @page rule.");
} else {
  console.log("ManagerReports header preflight: @page rule already normalized.");
}
