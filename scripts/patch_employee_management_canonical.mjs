import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(path, "utf8");

const legacyFunction = /\n  const saveCheckoutPolicy = async \(employeeId: string, minutes: number\) => \{[\s\S]*?\n  \};\n\n/;
if (legacyFunction.test(source)) source = source.replace(legacyFunction, "\n");
if (source.includes("saveCheckoutPolicy(")) throw new Error("Legacy checkout-policy save call remains in ManagerEmployees.tsx");

const payloadMarker = '        rotationDailyAttendanceGraceMinutes: form.scheduleType === "ROTATION" && form.rotationDailyAttendanceEnabled ? Math.min(180, Math.max(0, Number(form.rotationDailyAttendanceGraceMinutes) || 0)) : 0,\n        locationId: form.locationId || null, specialties,';
const payloadReplacement = '        rotationDailyAttendanceGraceMinutes: form.scheduleType === "ROTATION" && form.rotationDailyAttendanceEnabled ? Math.min(180, Math.max(0, Number(form.rotationDailyAttendanceGraceMinutes) || 0)) : 0,\n        earlyCheckoutGraceMinutes: earlyCheckoutGrace,\n        locationId: form.locationId || null, specialties,';
if (!source.includes(payloadReplacement) && source.includes(payloadMarker)) source = source.replace(payloadMarker, payloadReplacement);
if (!source.includes(payloadReplacement)) throw new Error("Canonical employee payload marker missing");

const earlyCheckoutValidation = '      const earlyCheckoutGrace = form.earlyCheckoutGrace.trim() === "" ? 0 : Math.min(1440, Math.max(0, Number(form.earlyCheckoutGrace) || 0));';
const earlyCheckoutValidationAligned = '      const earlyCheckoutGrace = form.earlyCheckoutGrace.trim() === "" ? 0 : Math.min(180, Math.max(0, Number(form.earlyCheckoutGrace) || 0));';
if (source.includes(earlyCheckoutValidation)) source = source.replace(earlyCheckoutValidation, earlyCheckoutValidationAligned, 1);
if (!source.includes(earlyCheckoutValidationAligned)) throw new Error("Frontend early checkout validation marker missing");

const addRoleMarker = '  const canAdd = canManage || role === "supervisor";';
const addRoleAligned = '  const canAdd = canManage;';
if (source.includes(addRoleMarker)) source = source.replace(addRoleMarker, addRoleAligned, 1);
if (!source.includes(addRoleAligned)) throw new Error("Employee add permission marker missing");

if (!source.includes("let savedEmployee: Employee | null = null;")) source = source.replace("      let savedEmployeeId = editingId;\n", "      let savedEmployeeId = editingId;\n      let savedEmployee: Employee | null = null;\n");
if (!source.includes("savedEmployee = result.employee || null;")) source = source.replace("          savedEmployeeId = result.employee?.id || editingId;\n", "          savedEmployeeId = result.employee?.id || editingId;\n          savedEmployee = result.employee || null;\n", 1);
if (!source.includes("const updated = await updateBackendEmployee(savedEmployeeId, payload);")) source = source.replace("          if (savedEmployeeId) await updateBackendEmployee(savedEmployeeId, payload);\n", "          if (savedEmployeeId) {\n            const updated = await updateBackendEmployee(savedEmployeeId, payload);\n            savedEmployee = updated.employee || null;\n          }\n");
const oldRefresh = "      setForm(emptyForm); setEditingId(null); setShowForm(false); await load(false);\n";
const newRefresh = "      if (savedEmployee) setEmployees((prev) => editingId ? prev.map((item) => item.id === savedEmployee!.id ? savedEmployee! : item) : [savedEmployee!, ...prev.filter((item) => item.id !== savedEmployee!.id)]);\n      setForm(emptyForm); setEditingId(null); setShowForm(false);\n      void load(false);\n";
if (source.includes(oldRefresh)) source = source.replace(oldRefresh, newRefresh, 1);
writeFileSync(path, source, "utf8");

const backendPath = new URL("../backend/src/employee-save-production-gateway.ts", import.meta.url);
let backend = readFileSync(backendPath, "utf8");
const refreshLine = "  await refreshProfessionalAttendanceFact(env, damascusDay, a, id);";
const refreshSafe = "  try { await refreshProfessionalAttendanceFact(env, damascusDay, a, id); } catch (error) { console.error(\"[employee-save] professional fact refresh deferred\", { employeeId: id, error }); }";
if (backend.includes(refreshLine) && !backend.includes("professional fact refresh deferred")) backend = backend.replace(refreshLine, refreshSafe, 1);
if (!backend.includes("professional fact refresh deferred")) throw new Error("Employee save central refresh marker missing");
writeFileSync(backendPath, backend, "utf8");

console.log("canonical employee management patch complete");
