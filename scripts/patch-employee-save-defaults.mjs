import { readFileSync } from "node:fs";

const file = new URL("../backend/src/index.ts", import.meta.url);
const source = readFileSync(file, "utf8");

// The canonical backend patch is applied by backend/scripts/patch-employee-save.mjs
// during the backend package prepare step. This root-level hook is intentionally
// idempotent so older deployment workflows can still call it without rewriting
// an already-patched Worker source file.
const required = [
  "early_checkout_grace_minutes",
  "previousScheduleType",
  "الخادم لم يؤكد حفظ جميع تعديلات الموظف في D1",
];
const missing = required.filter((anchor) => !source.includes(anchor));
if (missing.length) {
  throw new Error(`Employee save patch: backend canonical patch is incomplete (${missing.join(", ")}).`);
}
console.log("Employee save D1 patch already applied by backend prepare step.");
