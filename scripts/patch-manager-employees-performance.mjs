import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/pages/ManagerEmployees.tsx");
const source = fs.readFileSync(target, "utf8");

const oldRemove = `    const remove = async (e: Employee) => {
        if (!confirm(\`حذف الموظف «\${e.name}»؟\`))
            return;
        try {
            if (backendEnabled)
                await deleteBackendEmployee(e.id);
            else
                saveEmployees(employees.filter((x) => x.id !== e.id));
            await load(false);
            toast.success("تم حذف الموظف بنجاح");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "تعذر حذف الموظف.";
            setError(message);
            toast.error("تعذر حذف الموظف", message);
        }
    };`;

const newRemove = `    const remove = async (e: Employee) => {
        if (!confirm(\`حذف الموظف «\${e.name}»؟\`))
            return;
        setError(null);
        try {
            if (backendEnabled) {
                await deleteBackendEmployee(e.id);
                setEmployees((prev) => prev.filter((item) => item.id !== e.id));
                setEscapeEvents((prev) => prev.filter((item) => item.employeeId !== e.id));
            }
            else {
                const nextEmployees = employees.filter((x) => x.id !== e.id);
                saveEmployees(nextEmployees);
                setEmployees(nextEmployees);
            }
            toast.success("تم حذف الموظف بنجاح");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "تعذر حذف الموظف.";
            setError(message);
            toast.error("تعذر حذف الموظف", message);
        }
    };`;

const oldCreate = `                else {
                    const created = await createBackendEmployee({ ...payload, pin, avatar: null });
                    savedEmployeeId = created.employee?.id || null;
                    if (savedEmployeeId) {
                        const updated = await updateBackendEmployee(savedEmployeeId, payload);
                        savedEmployee = updated.employee || null;
                    }
                }`;

const newCreate = `                else {
                    const created = await createBackendEmployee({ ...payload, pin, avatar: null });
                    savedEmployeeId = created.employee?.id || null;
                    savedEmployee = created.employee || null;
                }`;

const hasRemove = source.includes(newRemove);
const hasCreate = source.includes(newCreate);
if (hasRemove && hasCreate) {
  process.stdout.write("manager employee performance patch already applied\\n");
  process.exit(0);
}

let next = source;
if (!hasRemove) {
  if (!next.includes(oldRemove)) {
    throw new Error("Expected ManagerEmployees delete handler was not found; refusing to patch an unknown source layout.");
  }
  next = next.replace(oldRemove, newRemove);
}

if (!hasCreate) {
  if (!next.includes(oldCreate)) {
    throw new Error("Expected ManagerEmployees create handler was not found; refusing to patch an unknown source layout.");
  }
  next = next.replace(oldCreate, newCreate);
}

fs.writeFileSync(target, next, "utf8");
process.stdout.write("manager employee performance patch applied\\n");
