import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/index.ts", import.meta.url);
let source = readFileSync(file, "utf8");

function replaceOnce(anchor, replacement, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw new Error(`Employee save patch: expected exactly one ${label} anchor, found ${count}.`);
  source = source.replace(anchor, replacement);
}

replaceOnce(
  "work_end_time TEXT,grace_period_minutes INTEGER NOT NULL DEFAULT 10,role TEXT NOT NULL DEFAULT 'staff'",
  "work_end_time TEXT,early_checkout_grace_minutes INTEGER,grace_period_minutes INTEGER NOT NULL DEFAULT 10,role TEXT NOT NULL DEFAULT 'staff'",
  "employee schema anchor",
);

replaceOnce(
  "gracePeriodMinutes:r.grace_period_minutes,role:r.role",
  "gracePeriodMinutes:r.grace_period_minutes,earlyCheckoutGraceMinutes:r.early_checkout_grace_minutes,role:r.role",
  "employee output anchor",
);

replaceOnce(
  "gracePeriodMinutes:\"grace_period_minutes\",role:\"role\"",
  "gracePeriodMinutes:\"grace_period_minutes\",earlyCheckoutGraceMinutes:\"early_checkout_grace_minutes\",role:\"role\"",
  "employee update mapping anchor",
);

replaceOnce(
  "if(!sets.length)return json({ok:true,employee:employeeOut(current)},200,origin);",
  "if(!sets.length)return json({error:\"لم تصل أي حقول قابلة للحفظ إلى خادم D1. لم يتم اعتبار العملية ناجحة.\"},400,origin);",
  "false-success guard",
);

replaceOnce(
  "if(b.specialties!==undefined){sets.push(\"specialties_json=?\");values.push(JSON.stringify(b.specialties));}",
  "if(b.specialties!==undefined){const specialties=Array.isArray(b.specialties)?b.specialties.map((item:any)=>String(item).trim()).filter(Boolean):String(b.specialties||\"\").split(\",\").map((item)=>item.trim()).filter(Boolean);sets.push(\"specialties_json=?\");values.push(JSON.stringify(specialties));}",
  "specialties normalization anchor",
);

replaceOnce(
  "if(b.workDays!==undefined){sets.push(\"work_days_json=?\");values.push(JSON.stringify(b.workDays));}",
  "if(b.workDays!==undefined){const workDays=Array.isArray(b.workDays)?b.workDays.map((item:any)=>Number(item)).filter((item)=>Number.isInteger(item)&&item>=0&&item<=6):[];sets.push(\"work_days_json=?\");values.push(JSON.stringify(workDays));}",
  "work-days normalization anchor",
);

writeFileSync(file, source, "utf8");
console.log("Employee save D1 patch applied.");
