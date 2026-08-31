import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

// Persist the early-checkout value in the same employee PATCH sent to the D1-backed API.
const payloadMarker = 'locationId: form.locationId || null, specialties,';
if (!source.includes(payloadMarker)) {
  throw new Error("Manager employee save patch: payload marker not found.");
}
if (!source.includes("earlyCheckoutGraceMinutes: earlyCheckoutGrace")) {
  source = source.replace(
    payloadMarker,
    `${payloadMarker}\n        earlyCheckoutGraceMinutes: earlyCheckoutGrace,`,
  );
}

// Never call the old secondary checkout-policy request. Employee edits must be one atomic API save.
source = source.replace(
  /\n\s*if\s*\(\s*savedEmployeeId\s*\)\s*await\s+saveCheckoutPolicy\s*\(\s*savedEmployeeId\s*,\s*earlyCheckoutGrace\s*\)\s*;?/g,
  "",
);

// Remove any legacy local saveCheckoutPolicy declaration regardless of formatting.
const policyStart = source.indexOf("const saveCheckoutPolicy = async");
if (policyStart >= 0) {
  const submitStart = source.indexOf("const submit = async", policyStart);
  if (submitStart < 0) {
    throw new Error("Manager employee save patch: submit function anchor not found after saveCheckoutPolicy.");
  }
  source = source.slice(0, policyStart) + source.slice(submitStart);
}

// A build must never ship a reference to the removed function.
if (source.includes("saveCheckoutPolicy")) {
  throw new Error("Manager employee save patch: stale saveCheckoutPolicy reference remains.");
}
if (!source.includes("earlyCheckoutGraceMinutes: earlyCheckoutGrace")) {
  throw new Error("Manager employee save patch: early checkout field was not inserted into employee payload.");
}

writeFileSync(file, source, "utf8");
console.log("Manager employee save patch applied: single verified D1 employee PATCH; no stale saveCheckoutPolicy reference.");
