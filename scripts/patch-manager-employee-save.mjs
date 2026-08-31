import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const payloadMarker = 'rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,';
if (!source.includes(payloadMarker)) throw new Error("Manager employee save patch: payload marker not found.");
if (!source.includes("earlyCheckoutGraceMinutes: earlyCheckoutGrace")) {
  source = source.replace(payloadMarker, `${payloadMarker}\n        earlyCheckoutGraceMinutes: earlyCheckoutGrace,`);
}

source = source.replace(/\n\s*if\(savedEmployeeId\) await saveCheckoutPolicy\(savedEmployeeId, earlyCheckoutGrace\);/, "");

const policyStart = '  const saveCheckoutPolicy = async (employeeId: string, minutes: number) => {';
const submitStart = '  const submit = async () => {';
const start = source.indexOf(policyStart);
const end = source.indexOf(submitStart, start);
if (start >= 0 && end > start) {
  source = source.slice(0, start) + source.slice(end);
}

writeFileSync(file, source, "utf8");
console.log("Manager employee save patch applied: early checkout is saved atomically with employee PATCH.");
