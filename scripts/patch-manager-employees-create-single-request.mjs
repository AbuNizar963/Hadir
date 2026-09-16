import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
const source = readFileSync(fileUrl, "utf8");

const oldBlock = `                else {\n                    const created = await createBackendEmployee({ ...payload, pin, avatar: null });\n                    savedEmployeeId = created.employee?.id || null;\n                    if (savedEmployeeId) {\n                        const updated = await updateBackendEmployee(savedEmployeeId, payload);\n                        savedEmployee = updated.employee || null;\n                    }\n                }`;

const newBlock = `                else {\n                    const created = await createBackendEmployee({ ...payload, pin, avatar: null });\n                    savedEmployeeId = created.employee?.id || null;\n                    savedEmployee = created.employee || null;\n                }`;

if (source.includes(newBlock)) {
  console.log("ManagerEmployees create optimization: already applied; no changes needed.");
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  throw new Error(
    "Refusing unsafe ManagerEmployees create patch: expected two-request creation block was not found.",
  );
}

const occurrences = source.split(oldBlock).length - 1;
if (occurrences !== 1) {
  throw new Error(
    `Refusing unsafe ManagerEmployees create patch: expected exactly one target block, found ${occurrences}.`,
  );
}

const next = source.replace(oldBlock, newBlock);
if (next === source || !next.includes(newBlock) || next.includes(oldBlock)) {
  throw new Error("Refusing unsafe ManagerEmployees create patch: replacement validation failed.");
}

writeFileSync(fileUrl, next, "utf8");
console.log("ManagerEmployees create optimization: creation now uses one backend request.");
