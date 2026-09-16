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

if (source.includes(newRemove)) {
  process.stdout.write("manager employee performance patch already applied\\n");
  process.exit(0);
}

if (!source.includes(oldRemove)) {
  throw new Error("Expected ManagerEmployees delete handler was not found; refusing to patch an unknown source layout.");
}

fs.writeFileSync(target, source.replace(oldRemove, newRemove), "utf8");
process.stdout.write("manager employee performance patch applied\\n");
