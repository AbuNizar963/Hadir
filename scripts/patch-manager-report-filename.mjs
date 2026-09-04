import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const current = 'const filename = "تقرير الحضور والغياب اليومي لـ " + companyName + " ليوم " + reportDay + " تاريخ " + displayDate + ".pdf";';
const agreed = 'const filename = companyName + " - سجل الحضور والغياب ليوم " + reportDay + " - " + displayDate + ".pdf";';

if (source.includes(current)) {
  source = source.replace(current, agreed);
  writeFileSync(file, source, "utf8");
  console.log("ManagerReports filename patch: restored agreed company + سجل الحضور والغياب + weekday + numeric date filename.");
} else if (source.includes(agreed)) {
  console.log("ManagerReports filename patch: agreed filename already present.");
} else {
  throw new Error("ManagerReports filename patch: expected filename anchor not found; refusing unsafe replacement.");
}
