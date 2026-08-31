import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const setFieldAnchor = 'const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((v) => ({ ...v, [key]: value })), []);';
const setFieldReplacement = 'const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((v) => { if (key === "scheduleType" && value === "ADMIN") return { ...v, scheduleType: "ADMIN", workStartTime: "08:00", workEndTime: "16:00", workDays: [0, 1, 2, 3, 4], rotationDaysOn: 7, rotationDaysOff: 7, rotationStartDate: "" }; return { ...v, [key]: value }; }), [];';
if (!source.includes(setFieldAnchor)) throw new Error("Employee form patch: setField anchor not found.");
if (!source.includes('key === "scheduleType" && value === "ADMIN"')) source = source.replace(setFieldAnchor, setFieldReplacement);

const payloadAnchor = 'const payload: Record<string, unknown> = {\n        name, jobNumber, status: form.status, scheduleType: form.scheduleType,\n        workStartTime: form.workStartTime || null, workEndTime: form.workEndTime || null,\n        gracePeriodMinutes: grace, workDays: form.workDays,\n        rotationDaysOn: Math.max(1, Number(form.rotationDaysOn) || 7),\n        rotationDaysOff: Math.max(0, Number(form.rotationDaysOff) || 7),\n        rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,\n      };';
const payloadReplacement = 'const isAdminSchedule = form.scheduleType === "ADMIN";\n      const payload: Record<string, unknown> = {\n        name, jobNumber, status: form.status, scheduleType: form.scheduleType,\n        workStartTime: isAdminSchedule ? (form.workStartTime || "08:00") : null, workEndTime: isAdminSchedule ? (form.workEndTime || "16:00") : null,\n        gracePeriodMinutes: grace, workDays: isAdminSchedule ? form.workDays : form.workDays,\n        rotationDaysOn: isAdminSchedule ? null : Math.max(1, Number(form.rotationDaysOn) || 7),\n        rotationDaysOff: isAdminSchedule ? null : Math.max(0, Number(form.rotationDaysOff) || 7),\n        rotationStartDate: isAdminSchedule ? null : (form.rotationStartDate || null), locationId: form.locationId || null, specialties,\n      };';
if (!source.includes(payloadAnchor)) throw new Error("Employee form patch: payload anchor not found.");
if (!source.includes('const isAdminSchedule = form.scheduleType === "ADMIN";')) source = source.replace(payloadAnchor, payloadReplacement);

writeFileSync(file, source, "utf8");
console.log("Employee form default schedule patch applied.");
