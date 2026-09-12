import { readFileSync, writeFileSync } from "node:fs";

function patch(path, replacements) {
  let source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const [oldText, newText] of replacements) {
    if (!source.includes(oldText)) throw new Error(`Expected employee-management marker missing in ${path}`);
    source = source.replace(oldText, newText);
  }
  writeFileSync(new URL(`../${path}`, import.meta.url), source, "utf8");
}

patch("src/pages/ManagerEmployees.tsx", [
  [
`  const saveCheckoutPolicy = async (employeeId: string, minutes: number) => {\n    const token = localStorage.getItem("hadir.api.token.admin") || "";\n    const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\\/$/, "");\n    const response = await fetch(`${api}/api/employees/${encodeURIComponent(employeeId)}/checkout-policy`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, credentials: "include", body: JSON.stringify({ earlyCheckoutMinutes: minutes }), cache: "no-store" });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر حفظ فترة السماح بالانصراف المبكر.");\n  };\n\n`, ""],
  [
`        if (savedEmployeeId) await saveCheckoutPolicy(savedEmployeeId, earlyCheckoutGrace);\n`, ""],
  [
`      let savedEmployeeId = editingId;\n`, `      let savedEmployeeId = editingId;\n      let savedEmployee: Employee | null = null;\n`],
  [
`          const result = await updateBackendEmployee(editingId, payload);\n          savedEmployeeId = result.employee?.id || editingId;\n`, `          const result = await updateBackendEmployee(editingId, payload);\n          savedEmployeeId = result.employee?.id || editingId;\n          savedEmployee = result.employee || null;\n`],
  [
`          if (savedEmployeeId) await updateBackendEmployee(savedEmployeeId, payload);\n`, `          if (savedEmployeeId) {\n            const updated = await updateBackendEmployee(savedEmployeeId, payload);\n            savedEmployee = updated.employee || null;\n          }\n`],
  [
`      setForm(emptyForm); setEditingId(null); setShowForm(false); await load(false);\n`, `      if (savedEmployee) setEmployees((prev) => editingId ? prev.map((item) => item.id === savedEmployee!.id ? savedEmployee! : item) : [savedEmployee!, ...prev.filter((item) => item.id !== savedEmployee!.id)]);\n      setForm(emptyForm); setEditingId(null); setShowForm(false);\n      void load(false);\n`],
]);

console.log("canonical employee save UI patch complete");
