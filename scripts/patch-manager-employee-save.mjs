import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const payloadAnchor = 'rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,\n      };';
const payloadReplacement = 'rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,\n        earlyCheckoutGraceMinutes: earlyCheckoutGrace,\n      };';
if (!source.includes(payloadAnchor)) throw new Error("Manager employee save patch: payload anchor not found.");
if (!source.includes("earlyCheckoutGraceMinutes: earlyCheckoutGrace")) source = source.replace(payloadAnchor, payloadReplacement);

const policyBlock = `        if (savedEmployeeId) await saveCheckoutPolicy(savedEmployeeId, earlyCheckoutGrace);`;
if (!source.includes(policyBlock)) throw new Error("Manager employee save patch: legacy checkout-policy call not found.");
source = source.replace(policyBlock, "");

const policyFunctionStart = '  const saveCheckoutPolicy = async (employeeId: string, minutes: number) => {';
const policyFunctionEnd = '  const submit = async () => {';
const start = source.indexOf(policyFunctionStart);
const end = source.indexOf(policyFunctionEnd, start);
if (start < 0 || end < 0) throw new Error("Manager employee save patch: legacy checkout-policy function not found.");
source = source.slice(0, start) + source.slice(end);

writeFileSync(file, source, "utf8");
console.log("Manager employee save patch applied: early checkout is saved atomically with employee PATCH.");
