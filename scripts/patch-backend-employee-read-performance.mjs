import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/lib/backend.ts", import.meta.url);
const source = readFileSync(fileUrl, "utf8");

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

const functionPattern =
  /export async function getBackendEmployees\(\) \{[\s\S]*?\n\}\n(?=export async function createBackendEmployee)/g;
const matches = [...source.matchAll(functionPattern)];

if (matches.length !== 1) {
  throw new Error(
    `Backend employee read performance patch: expected exactly one getBackendEmployees function, found ${matches.length}; refusing unsafe replacement.`,
  );
}

const currentFunction = matches[0][0];
const parallelMarker = "const [employees, controls] = await Promise.all([";
const controlsPathMarker = '"/api/manager/workforce-controls"';

const alreadyParallel =
  currentFunction.includes(parallelMarker) &&
  currentFunction.includes(controlsPathMarker);

if (alreadyParallel) {
  console.log(
    "Backend employee read performance patch: already applied; skipping.",
  );
  process.exit(0);
}

const expectedEmployeeRead = currentFunction.includes(
  'const employees = await request<Employee[]>("/api/employees", {}, "admin");',
);
const expectedControlsRead = currentFunction.includes(
  'const controls = await request<',
);
const expectedControlsPath = currentFunction.includes(controlsPathMarker);
const expectedMerge =
  currentFunction.includes("const byId = new Map") &&
  currentFunction.includes("avatar: employeeAvatarUrl(employee.avatar, employee.id)");

if (
  !expectedEmployeeRead ||
  !expectedControlsRead ||
  !expectedControlsPath ||
  !expectedMerge
) {
  throw new Error(
    "Backend employee read performance patch: current getBackendEmployees implementation does not match the expected sequential-read shape; refusing unsafe replacement.",
  );
}

const functionStart = matches[0].index;
if (functionStart == null) {
  throw new Error(
    "Backend employee read performance patch: function location could not be determined; refusing unsafe replacement.",
  );
}

const next =
  source.slice(0, functionStart) +
  optimized +
  "\n" +
  source.slice(functionStart + currentFunction.length);

if (
  !next.includes(parallelMarker) ||
  !next.includes(controlsPathMarker) ||
  next.includes('const employees = await request<Employee[]>("/api/employees", {}, "admin");')
) {
  throw new Error(
    "Backend employee read performance patch: post-replacement validation failed; refusing partial write.",
  );
}

writeFileSync(fileUrl, next, "utf8");
console.log(
  "Backend employee read performance patch: parallel employee/control reads applied.",
);
