import { useCallback, useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import SmartEmployeeImport from "@/components/employees/SmartEmployeeImport";
import { backendEnabled, createBackendEmployee, deleteBackendEmployee, getBackendEmployees, getBackendLocations, resetBackendEmployeeDevice, updateBackendEmployee } from "@/lib/backend";
import { getEmployees, saveEmployees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, Location, ScheduleType, UserRole } from "@/types";

type FormState = {
  name: string; jobNumber: string; pin: string; status: "active" | "suspended";
  role: UserRole; scheduleType: ScheduleType; workStartTime: string; workEndTime: string;
  gracePeriodMinutes: number; workDays: number[]; rotationDaysOn: number; rotationDaysOff: number;
  rotationStartDate: string; locationId: string; specialties: string;
};

const emptyForm: FormState = {
  name: "", jobNumber: "", pin: "", status: "active", role: "staff", scheduleType: "ADMIN",
  workStartTime: "08:00", workEndTime: "16:00", gracePeriodMinutes: 0, workDays: [0, 1, 2, 3, 4],
  rotationDaysOn: 7, rotationDaysOff: 7, rotationStartDate: "", locationId: "", specialties: "general",
};
const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function formFromEmployee(e: Employee): FormState {
  return {
    name: e.name, jobNumber: e.jobNumber, pin: "", status: e.status, role: e.role || "staff",
    scheduleType: e.scheduleType || "ADMIN", workStartTime: e.workStartTime || "08:00", workEndTime: e.workEndTime || "16:00",
    gracePeriodMinutes: e.gracePeriodMinutes ?? 0, workDays: e.workDays || [0, 1, 2, 3, 4],
    rotationDaysOn: e.rotationDaysOn ?? 7, rotationDaysOff: e.rotationDaysOff ?? 7,
    rotationStartDate: e.rotationStartDate || "", locationId: e.locationId || "", specialties: (e.specialties || []).join(", "),
  };
}

export default function ManagerEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
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
      if (backendEnabled) {
        try { setLocations(await getBackendLocations("admin")); } catch { setLocations([]); }
      }
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل الموظفين."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (day: number) => setForm((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((d) => d !== day) : [...current.workDays, day].sort() }));

  const submit = async () => {
    const name = form.name.trim(), jobNumber = form.jobNumber.trim();
    if (!name || !jobNumber) { setError("اسم الموظف والرقم الوظيفي مطلوبان."); return; }
    if (!editingId && form.pin.trim().length < 4) { setError("رمز PIN يجب أن يتكون من 4 أحرف/أرقام على الأقل."); return; }
    if (!form.workDays.length && form.scheduleType === "ADMIN") { setError("اختر يوم دوام واحدًا على الأقل."); return; }
    setSaving(true); setError(null);
    const specialties = form.specialties.split(",").map((x) => x.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      name, jobNumber, status: form.status, role: form.role, scheduleType: form.scheduleType,
      workStartTime: form.workStartTime || null, workEndTime: form.workEndTime || null,
      gracePeriodMinutes: Math.max(0, Number(form.gracePeriodMinutes) || 0), workDays: form.workDays,
      rotationDaysOn: Math.max(1, Number(form.rotationDaysOn) || 7), rotationDaysOff: Math.max(0, Number(form.rotationDaysOff) || 7),
      rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,
    };
    if (form.pin.trim()) payload.pin = form.pin.trim();
    try {
      if (backendEnabled) {
        if (editingId) await updateBackendEmployee(editingId, payload);
        else await createBackendEmployee({ ...payload, pin: form.pin.trim(), avatar: null });
      } else {
        if (editingId) {
          const current = employees.find((e) => e.id === editingId); if (!current) throw new Error("الموظف غير موجود.");
          const updated: Employee = { ...current, ...payload, jobNumber: current.jobNumber, ...(form.pin.trim() ? { pinHash: hash(form.pin.trim()) } : {}) } as Employee;
          saveEmployees(employees.map((e) => e.id === editingId ? updated : e));
        } else {
          const employee: Employee = { id: generateId(), name, jobNumber, pinHash: hash(form.pin.trim()), status: form.status, deviceId: null, deviceLabel: null, createdAt: new Date().toISOString(), role: form.role, scheduleType: form.scheduleType, workStartTime: form.workStartTime, workEndTime: form.workEndTime, gracePeriodMinutes: form.gracePeriodMinutes, workDays: form.workDays, rotationDaysOn: form.rotationDaysOn, rotationDaysOff: form.rotationDaysOff, rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties, avatar: null };
          saveEmployees([employee, ...employees]);
        }
      }
      setForm(emptyForm); setEditingId(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الموظف."); }
    finally { setSaving(false); }
  };

  const edit = (employee: Employee) => { setEditingId(employee.id); setForm(formFromEmployee(employee)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (employee: Employee) => {
    if (!confirm(`حذف الموظف «${employee.name}»؟`)) return;
    try { if (backendEnabled) await deleteBackendEmployee(employee.id); else saveEmployees(employees.filter((e) => e.id !== employee.id)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف الموظف."); }
  };
  const resetDevice = async (employee: Employee) => {
    if (!confirm(`إلغاء ربط جهاز «${employee.name}»؟ سيتمكن الموظف من ربط جهاز جديد عند تسجيل الدخول.`)) return;
    try { if (backendEnabled) await resetBackendEmployeeDevice(employee.id); else saveEmployees(employees.map((e) => e.id === employee.id ? { ...e, deviceId: null, deviceLabel: null } : e)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر إلغاء ربط الجهاز."); }
  };
  const visible = employees.filter((e) => `${e.name} ${e.jobNumber} ${e.deviceLabel || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <ManagerLayout title="الموظفون" subtitle="إدارة حسابات الموظفين وبياناتهم من قاعدة بيانات D1">
    <div className="space-y-5">
      <section className="hud-card p-5">
        <div className="text-xs mono text-primary font-bold mb-3">SMART IMPORT · استيراد Excel / CSV</div>
        <SmartEmployeeImport onImported={() => void load()} />
      </section>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div><h2 className="font-bold text-base">{editingId ? "تعديل موظف" : "إضافة موظف"}</h2><p className="text-xs text-muted-foreground mt-1">بيانات الحساب والدوام وموقع العمل والجهاز في نموذج واحد.</p></div>
          {editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>إلغاء التعديل</button>}
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-xs mono text-primary font-bold mb-3">01 · بيانات الموظف</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input className="input" placeholder="اسم الموظف" value={form.name} onChange={(e) => setField("name", e.target.value)} />
              <input className="input mono" placeholder="الرقم الوظيفي" value={form.jobNumber} disabled={Boolean(editingId)} onChange={(e) => setField("jobNumber", e.target.value)} />
              <input className="input mono" type="password" placeholder={editingId ? "PIN جديد (اختياري)" : "PIN"} value={form.pin} onChange={(e) => setField("pin", e.target.value)} />
              <select className="input" value={form.status} onChange={(e) => setField("status", e.target.value as FormState["status"])}><option value="active">فعال</option><option value="suspended">موقوف</option></select>
            </div>
          </div>

          <div>
            <div className="text-xs mono text-primary font-bold mb-3">02 · الصلاحية ونوع الدوام</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <select className="input" value={form.role} onChange={(e) => setField("role", e.target.value as UserRole)}><option value="staff">موظف</option><option value="supervisor">مشرف</option><option value="manager">مدير</option></select>
              <select className="input" value={form.scheduleType} onChange={(e) => setField("scheduleType", e.target.value as ScheduleType)}><option value="ADMIN">إداري</option><option value="ROTATION">تناوبي</option></select>
              <input className="input" type="time" aria-label="بداية الدوام" value={form.workStartTime} onChange={(e) => setField("workStartTime", e.target.value)} />
              <input className="input" type="time" aria-label="نهاية الدوام" value={form.workEndTime} onChange={(e) => setField("workEndTime", e.target.value)} />
            </div>
          </div>

          <div>
            <div className="text-xs mono text-primary font-bold mb-3">03 · الدوام والموقع</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <input className="input" type="number" min="0" placeholder="دقائق السماح بالتأخير" value={form.gracePeriodMinutes} onChange={(e) => setField("gracePeriodMinutes", Number(e.target.value))} />
              <select className="input" value={form.locationId} onChange={(e) => setField("locationId", e.target.value)}><option value="">المقر الرئيسي</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <input className="input lg:col-span-2" placeholder="التخصصات (مفصولة بفواصل)" value={form.specialties} onChange={(e) => setField("specialties", e.target.value)} />
            </div>
            <div className="mt-4"><div className="text-sm font-semibold mb-2">أيام الدوام</div><div className="flex flex-wrap gap-2">{dayNames.map((day, i) => <button key={day} type="button" className={form.workDays.includes(i) ? "btn-primary text-xs" : "btn-secondary text-xs"} onClick={() => toggleDay(i)}>{day}</button>)}</div></div>
          </div>

          {form.scheduleType === "ROTATION" && <div className="rounded-xl border p-4">
            <div className="text-xs mono text-primary font-bold mb-3">04 · إعدادات الدوام التناوبي</div>
            <div className="grid md:grid-cols-3 gap-3">
              <input className="input" type="number" min="1" placeholder="أيام العمل" value={form.rotationDaysOn} onChange={(e) => setField("rotationDaysOn", Number(e.target.value))} />
              <input className="input" type="number" min="0" placeholder="أيام الراحة" value={form.rotationDaysOff} onChange={(e) => setField("rotationDaysOff", Number(e.target.value))} />
              <input className="input" type="date" aria-label="بداية التناوب" value={form.rotationStartDate} onChange={(e) => setField("rotationStartDate", e.target.value)} />
            </div>
          </div>}
        </div>

        <button type="button" className="btn-primary mt-5" disabled={saving} onClick={() => void submit()}>{saving ? "جاري الحفظ…" : editingId ? "حفظ التعديل" : "إضافة الموظف"}</button>
        {error && <div className="mt-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm">{error}</div>}
      </section>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h2 className="font-bold">قائمة الموظفين ({employees.length})</h2><p className="text-xs text-muted-foreground mt-1">نوع الهاتف والجهاز الموثق يظهران تحت اسم كل موظف.</p></div>
          <input className="input max-w-xs" placeholder="بحث بالاسم أو الرقم أو الجهاز" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {loading ? <div className="text-sm text-muted-foreground">جاري تحميل الموظفين من الخادم…</div> : visible.length === 0 ? <div className="text-sm text-muted-foreground">لا توجد نتائج.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-right">الموظف</th><th className="p-2 text-right">الدوام</th><th className="p-2 text-right">موقع العمل</th><th className="p-2 text-right">الهاتف / الجهاز</th><th className="p-2 text-right">الحالة</th><th className="p-2 text-right">الإجراء</th></tr></thead><tbody>{visible.map((e) => { const location = locations.find((l) => String(l.id) === String(e.locationId)) || locations.find((l) => l.id === "main"); return <tr key={e.id} className="border-b align-top"><td className="p-2"><div className="font-semibold">{e.name}</div><div className="mono text-xs text-muted-foreground">{e.jobNumber}</div><div className="text-xs">{e.role === "manager" ? "مدير" : e.role === "supervisor" ? "مشرف" : "موظف"}</div><div className="text-xs mt-1 text-muted-foreground">📱 {e.deviceLabel || "الهاتف غير مرتبط"}</div></td><td className="p-2 text-xs"><div>{e.scheduleType === "ROTATION" ? "تناوبي" : "إداري"}</div><div>{e.workStartTime || "--:--"} → {e.workEndTime || "--:--"}</div><div>سماح: {e.gracePeriodMinutes ?? 0} د</div></td><td className="p-2 text-xs">{location?.name || "المقر الرئيسي"}</td><td className="p-2 text-xs"><div>{e.deviceLabel || "غير مرتبط"}</div><div className="mono text-[10px]">{e.deviceId ? "جهاز موثق" : "لا يوجد جهاز"}</div>{e.deviceId && <button type="button" className="text-destructive mt-1" onClick={() => void resetDevice(e)}>إلغاء ربط الجهاز</button>}</td><td className="p-2">{e.status === "active" ? "فعال" : "موقوف"}</td><td className="p-2"><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary text-xs" onClick={() => edit(e)}>تعديل</button><button type="button" className="text-destructive text-xs" onClick={() => void remove(e)}>حذف</button></div></td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  </ManagerLayout>;
}
