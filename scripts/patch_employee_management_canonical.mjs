import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(path, "utf8");

const legacyFunction = /\n  const saveCheckoutPolicy = async \(employeeId: string, minutes: number\) => \{[\s\S]*?\n  \};\n\n/;
if (legacyFunction.test(source)) source = source.replace(legacyFunction, "\n");
if (source.includes("saveCheckoutPolicy(")) throw new Error("Legacy checkout-policy save call remains in ManagerEmployees.tsx");

const payloadMarker = '        rotationDailyAttendanceGraceMinutes: form.scheduleType === "ROTATION" && form.rotationDailyAttendanceEnabled ? Math.min(180, Math.max(0, Number(form.rotationDailyAttendanceGraceMinutes) || 0)) : 0,\n        locationId: form.locationId || null, specialties,';
const payloadReplacement = '        rotationDailyAttendanceGraceMinutes: form.scheduleType === "ROTATION" && form.rotationDailyAttendanceEnabled ? Math.min(180, Math.max(0, Number(form.rotationDailyAttendanceGraceMinutes) || 0)) : 0,\n        earlyCheckoutGraceMinutes: earlyCheckoutGrace,\n        locationId: form.locationId || null, specialties,';
if (source.includes(payloadReplacement)) {
  // Canonical payload is already present.
} else if (source.includes(payloadMarker)) {
  source = source.replace(payloadMarker, payloadReplacement);
} else {
  throw new Error("Canonical employee payload marker missing");
}

if (!source.includes("let savedEmployee: Employee | null = null;")) {
  source = source.replace("      let savedEmployeeId = editingId;\n", "      let savedEmployeeId = editingId;\n      let savedEmployee: Employee | null = null;\n");
}
if (!source.includes("savedEmployee = result.employee || null;")) {
  source = source.replace("          savedEmployeeId = result.employee?.id || editingId;\n", "          savedEmployeeId = result.employee?.id || editingId;\n          savedEmployee = result.employee || null;\n", 1);
}
if (!source.includes("const updated = await updateBackendEmployee(savedEmployeeId, payload);")) {
  source = source.replace("          if (savedEmployeeId) await updateBackendEmployee(savedEmployeeId, payload);\n", "          if (savedEmployeeId) {\n            const updated = await updateBackendEmployee(savedEmployeeId, payload);\n            savedEmployee = updated.employee || null;\n          }\n");
}
const oldRefresh = "      setForm(emptyForm); setEditingId(null); setShowForm(false); await load(false);\n";
const newRefresh = "      if (savedEmployee) setEmployees((prev) => editingId ? prev.map((item) => item.id === savedEmployee!.id ? savedEmployee! : item) : [savedEmployee!, ...prev.filter((item) => item.id !== savedEmployee!.id)]);\n      setForm(emptyForm); setEditingId(null); setShowForm(false);\n      void load(false);\n";
if (source.includes(oldRefresh)) source = source.replace(oldRefresh, newRefresh, 1);
writeFileSync(path, source, "utf8");
console.log("canonical employee save UI patch complete");
