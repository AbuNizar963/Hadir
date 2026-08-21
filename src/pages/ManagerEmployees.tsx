import { useCallback, useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import SmartEmployeeImport from "@/components/employees/SmartEmployeeImport";
import { backendEnabled, createBackendEmployee, deleteBackendEmployee, getBackendEmployees, updateBackendEmployee } from "@/lib/backend";
import { getEmployees, saveEmployees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee } from "@/types";

type FormState = { name: string; jobNumber: string; pin: string; status: "active" | "suspended" };
const emptyForm: FormState = { name: "", jobNumber: "", pin: "", status: "active" };

export default function ManagerEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = backendEnabled ? await getBackendEmployees() : getEmployees();
      setEmployees(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الموظفين.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const name = form.name.trim();
    const jobNumber = form.jobNumber.trim();
    if (!name || !jobNumber) { setError("اسم الموظف والرقم الوظيفي مطلوبان."); return; }
    if (!editingId && form.pin.trim().length < 4) { setError("رمز PIN يجب أن يتكون من 4 أحرف/أرقام على الأقل."); return; }
    setSaving(true); setError(null);
    try {
      if (backendEnabled) {
        if (editingId) {
          const payload: Record<string, unknown> = { name, status: form.status };
          if (form.pin.trim()) payload.pin = form.pin.trim();
          await updateBackendEmployee(editingId, payload);
        } else {
          await createBackendEmployee({ name, jobNumber, pin: form.pin.trim(), status: form.status, role: "staff", scheduleType: "ADMIN", workDays: [0, 1, 2, 3, 4], specialties: ["general"], avatar: null });
        }
      } else {
        if (editingId) {
          const current = employees.find((item) => item.id === editingId);
          if (!current) throw new Error("الموظف غير موجود.");
          const updated: Employee = { ...current, name, status: form.status, ...(form.pin.trim() ? { pinHash: hash(form.pin.trim()) } : {}) };
          saveEmployees(employees.map((item) => item.id === editingId ? updated : item));
        } else {
          const employee: Employee = { id: generateId(), name, jobNumber, pinHash: hash(form.pin.trim()), status: form.status, deviceId: null, deviceLabel: null, createdAt: new Date().toISOString(), role: "staff", scheduleType: "ADMIN", workDays: [0, 1, 2, 3, 4], specialties: ["general"], avatar: null };
          saveEmployees([employee, ...employees]);
        }
      }
      setForm(emptyForm); setEditingId(null); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الموظف.");
    } finally { setSaving(false); }
  };

  const edit = (employee: Employee) => { setEditingId(employee.id); setForm({ name: employee.name, jobNumber: employee.jobNumber, pin: "", status: employee.status }); setError(null); };
  const remove = async (employee: Employee) => {
    if (!confirm(`حذف الموظف «${employee.name}»؟`)) return;
    try { if (backendEnabled) await deleteBackendEmployee(employee.id); else saveEmployees(employees.filter((item) => item.id !== employee.id)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف الموظف."); }
  };

  const visible = employees.filter((employee) => `${employee.name} ${employee.jobNumber}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <ManagerLayout title="الموظفون" subtitle="إدارة حسابات الموظفين وبياناتهم من قاعدة بيانات D1">
    <div className="space-y-5">
      <section className="hud-card p-5">
        <div className="text-xs mono text-primary font-bold mb-3">SMART IMPORT · استيراد Excel / CSV</div>
        <SmartEmployeeImport onImported={() => void load()} />
      </section>
      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h2 className="font-bold">{editingId ? "تعديل موظف" : "إضافة موظف"}</h2><p className="text-xs text-muted-foreground">الحفظ يتم على الخادم عند تفعيل Cloudflare.</p></div>
          {editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>إلغاء التعديل</button>}
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="input" placeholder="اسم الموظف" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input mono" placeholder="الرقم الوظيفي" value={form.jobNumber} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, jobNumber: e.target.value })} />
          <input className="input mono" type="password" placeholder={editingId ? "PIN جديد (اختياري)" : "PIN"} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}><option value="active">فعال</option><option value="suspended">موقوف</option></select>
        </div>
        <button type="button" className="btn-primary mt-3" disabled={saving} onClick={() => void submit()}>{saving ? "جاري الحفظ…" : editingId ? "حفظ التعديل" : "إضافة الموظف"}</button>
        {error && <div className="mt-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm">{error}</div>}
      </section>
      <section className="hud-card p-5">
        <div className="flex flex-wrap justify-between gap-3 mb-4"><h2 className="font-bold">قائمة الموظفين ({employees.length})</h2><input className="input max-w-xs" placeholder="بحث بالاسم أو الرقم" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {loading ? <div className="text-sm text-muted-foreground">جاري تحميل الموظفين من الخادم…</div> : visible.length === 0 ? <div className="text-sm text-muted-foreground">لا توجد نتائج.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-right">الاسم</th><th className="p-2 text-right">الرقم الوظيفي</th><th className="p-2 text-right">الحالة</th><th className="p-2 text-right">الإجراء</th></tr></thead><tbody>{visible.map((employee) => <tr key={employee.id} className="border-b"><td className="p-2 font-semibold">{employee.name}</td><td className="p-2 mono">{employee.jobNumber}</td><td className="p-2">{employee.status === "active" ? "فعال" : "موقوف"}</td><td className="p-2"><div className="flex gap-2"><button type="button" className="btn-secondary text-xs" onClick={() => edit(employee)}>تعديل</button><button type="button" className="text-destructive text-xs" onClick={() => void remove(employee)}>حذف</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </ManagerLayout>;
}
