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

if (source.includes(optimized)) {
  console.log("Backend employee read performance patch: already applied; skipping.");
  process.exit(0);
}

if (!source.includes(legacy)) {
  throw new Error("Backend employee read performance patch: expected getBackendEmployees implementation was not found; refusing unsafe replacement.");
}

const next = source.replace(legacy, optimized);
writeFileSync(fileUrl, next, "utf8");
console.log("Backend employee read performance patch: parallel employee/control reads applied.");
