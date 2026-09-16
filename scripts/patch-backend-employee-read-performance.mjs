import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/lib/backend.ts", import.meta.url);
const source = readFileSync(fileUrl, "utf8");

const legacy = `export async function getBackendEmployees() { const employees = await request<Employee[]>("/api/employees", {}, "admin"); const controls = await request<Array<{ id: string; isVip?: boolean; autoCheckIn?: boolean; autoCheckOut?: boolean }>>("/api/manager/workforce-controls", {}, "admin").catch(() => []); const byId = new Map(controls.map((control) => [String(control.id), control])); return employees.map((employee) => { const control = byId.get(String(employee.id)); return { ...employee, ...(control ? { isVip: Boolean(control.isVip), autoCheckIn: Boolean(control.autoCheckIn), autoCheckOut: Boolean(control.autoCheckOut) } : {}), avatar: employeeAvatarUrl(employee.avatar, employee.id) }; }); }`;

const optimized = `export async function getBackendEmployees() {
  const [employees, controls] = await Promise.all([
    request<Employee[]>("/api/employees", {}, "admin"),
    request<Array<{ id: string; isVip?: boolean; autoCheckIn?: boolean; autoCheckOut?: boolean }>>(
      "/api/manager/workforce-controls",
      {},
      "admin",
    ).catch(() => []),
  ]);

  const byId = new Map(controls.map((control) => [String(control.id), control]));

  return employees.map((employee) => {
    const control = byId.get(String(employee.id));

    return {
      ...employee,
      ...(control
        ? {
            isVip: Boolean(control.isVip),
            autoCheckIn: Boolean(control.autoCheckIn),
            autoCheckOut: Boolean(control.autoCheckOut),
          }
        : {}),
      avatar: employeeAvatarUrl(employee.avatar, employee.id),
    };
  });
}`;

function countOccurrences(value, fragment) {
  return value.split(fragment).length - 1;
}

const functionMarker = "export async function getBackendEmployees()";
const parallelMarker = "const [employees, controls] = await Promise.all([";
const controlsPathMarker = '"/api/manager/workforce-controls"';

if (source.includes(parallelMarker) && source.includes(controlsPathMarker)) {
  const functionStart = source.indexOf(functionMarker);
  const parallelStart = source.indexOf(parallelMarker);

  if (functionStart >= 0 && parallelStart > functionStart) {
    console.log(
      "Backend employee read performance patch: already applied; skipping.",
    );
    process.exit(0);
  }
}

const legacyOccurrences = countOccurrences(source, legacy);
if (legacyOccurrences !== 1) {
  throw new Error(
    `Backend employee read performance patch: expected exactly one legacy getBackendEmployees implementation, found ${legacyOccurrences}; refusing unsafe replacement.`,
  );
}

const next = source.replace(legacy, optimized);

if (
  !next.includes(parallelMarker) ||
  !next.includes(controlsPathMarker) ||
  next.includes(legacy)
) {
  throw new Error(
    "Backend employee read performance patch: post-replacement validation failed; refusing partial write.",
  );
}

writeFileSync(fileUrl, next, "utf8");
console.log(
  "Backend employee read performance patch: parallel employee/control reads applied.",
);
