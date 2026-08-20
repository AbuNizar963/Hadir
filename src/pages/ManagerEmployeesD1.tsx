import { useCallback, useEffect, useState } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import {
  backendEnabled,
  createBackendEmployee,
  deleteBackendEmployee,
  getBackendEmployees,
  resetBackendEmployeeDevice,
  updateBackendEmployee,
} from "@/lib/backend";
import type { Employee, EmployeeStatus, ScheduleType } from "@/types";

export default function ManagerEmployeesD1() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("ADMIN");
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");

  const load = useCallback(async () => {
    if (!backendEnabled) { setError("الاتصال بـD1 غير مفعّل في هذه النسخة."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // D1 is the authoritative source. Deliberately do not hydrate this page from localStorage.
      setEmployees(await getBackendEmployees());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر قراءة بيانات الموظفين من D1.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), 30000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [load]);

  const notify = (message: string) => { setSuccess(message); window.setTimeout(() => setSuccess(null), 3000); };
  const resetForm = () => { setEditingId(null); setName(""); setJobNumber(""); setPin(""); setScheduleType("ADMIN"); setWorkStartTime("08:00"); setWorkEndTime("16:00"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const cleanName = name.trim(), cleanJob = jobNumber.trim(), cleanPin = pin.trim();
    if (!cleanName || !cleanJob) return setError("اسم الموظف والرقم الوظيفي مطلوبان.");
    if (!editingId && cleanPin.length < 4) return setError("رمز PIN يجب أن يحتوي على 4 أحرف/أرقام على الأقل.");
    setSaving(true);
    try {
      if (editingId) {
        const current = employees.find(e => e.id === editingId);
        if (!current) throw new Error("الموظف غير موجود في D1. أعد تحميل الصفحة.");
        await updateBackendEmployee(editingId, {
          name: cleanName,
          status: current.status,
          scheduleType,
          workStartTime,
          workEndTime,
          ...(cleanPin ? { pin: cleanPin } : {}),
        });
        notify("تم حفظ بيانات الموظف في D1.");
      } else {
        await createBackendEmployee({ name: cleanName, jobNumber: cleanJob, pin: cleanPin, status: "active", scheduleType, workStartTime, workEndTime, role: "staff", specialties: ["general"], workDays: [0,1,2,3,4] });
        notify("تم إنشاء الموظف وحفظه مباشرة في D1.");
      }
      resetForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الموظف في D1."); }
    finally { setSaving(false); }
  };

  const edit = (employee: Employee) => {
    setEditingId(employee.id); setName(employee.name); setJobNumber(employee.jobNumber); setPin("");
    setScheduleType(employee.scheduleType || "ADMIN"); setWorkStartTime(employee.workStartTime || "08:00"); setWorkEndTime(employee.workEndTime || "16:00");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (employee: Employee) => {
    if (!confirm(`حذف الموظف ${employee.name} نهائيًا من D1؟`)) return;
    setError(null); setSaving(true);
    try { await deleteBackendEmployee(employee.id); notify("تم حذف الموظف من D1."); await load(); if (editingId === employee.id) resetForm(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف الموظف من D1."); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (employee: Employee) => {
    setError(null); setSaving(true);
    try {
      const status: EmployeeStatus = employee.status === "active" ? "suspended" : "active";
      await updateBackendEmployee(employee.id, { status });
      notify("تم تحديث حالة الموظف في D1."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث حالة الموظف."); }
    finally { setSaving(false); }
  };

  const resetDevice = async (employee: Employee) => {
    if (!confirm(`فك ربط جهاز ${employee.name}؟ بعد ذلك سيُسمح لأول جهاز بتسجيل الدخول وربطه في D1.`)) return;
    setError(null); setSaving(true);
    try { await resetBackendEmployeeDevice(employee.id); notify("تم فك ربط الجهاز في D1. لا توجد نسخة محلية للحالة."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر فك ربط الجهاز."); }
    finally { setSaving(false); }
  };

  return <ManagerLayout title="إدارة الموظفين" subtitle="D1 هو المصدر الوحيد لبيانات الموظفين والأجهزة">
    <div className="space-y-6">
      {success && <div className="hud-card p-4 border border-primary/40 text-sm font-bold">✓ {success}</div>}
      {error && <div className="hud-card p-4 border border-destructive/40 bg-destructive/5 text-sm text-destructive">{error}</div>}

      <form onSubmit={submit} className="hud-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3"><div><div className="text-xs mono text-muted-foreground">{editingId ? "EDIT · D1" : "CREATE · D1"}</div><h2 className="text-lg font-bold">{editingId ? "تعديل الموظف" : "إضافة موظف"}</h2></div>{editingId && <button type="button" onClick={resetForm} className="btn-secondary text-xs">إلغاء</button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input" placeholder="اسم الموظف" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="الرقم الوظيفي" value={jobNumber} onChange={e => setJobNumber(e.target.value)} disabled={!!editingId} />
          <input className="input" placeholder={editingId ? "PIN جديد (اختياري)" : "PIN"} value={pin} onChange={e => setPin(e.target.value)} type="password" autoComplete="new-password" />
          <select className="input" value={scheduleType} onChange={e => setScheduleType(e.target.value as ScheduleType)}><option value="ADMIN">دوام إداري</option><option value="ROTATION">نظام تناوبي</option></select>
          <input className="input" type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} />
          <input className="input" type="time" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={saving}>{saving ? "جاري الحفظ في D1…" : editingId ? "حفظ التعديلات في D1" : "إنشاء الموظف في D1"}</button>
      </form>

      <section className="hud-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className="font-bold">الموظفون</h2><p className="text-xs text-muted-foreground">البيانات المعروضة الآن تُقرأ مباشرة من Cloudflare D1.</p></div><button onClick={() => void load()} className="btn-secondary text-xs" disabled={loading}>{loading ? "جاري القراءة…" : "تحديث من D1"}</button></div>
        {loading && employees.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">جاري تحميل البيانات من D1…</div> : employees.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">لا يوجد موظفون في D1.</div> : <div className="space-y-3">
          {employees.map(employee => <div key={employee.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0"><div className="font-bold">{employee.name}</div><div className="text-xs text-muted-foreground mono mt-1">رقم الموظف: {employee.jobNumber}</div></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs min-w-[min(100%,520px)]">
                <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground mb-1">الحالة</div><b>{employee.status === "active" ? "نشط" : "موقوف"}</b></div>
                <div className={`rounded-xl border p-3 ${employee.deviceId ? "border-primary/40 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}><div className="text-muted-foreground mb-1">الجهاز من D1</div><b>{employee.deviceId ? "🟢 مربوط" : "🔴 غير مربوط"}</b></div>
                <div className="rounded-xl border border-border p-3 col-span-2 sm:col-span-1"><div className="text-muted-foreground mb-1">معرف الجهاز</div><b className="mono break-all">{employee.deviceId || "—"}</b></div>
              </div>
            </div>
            {employee.deviceId && <div className="mt-3 text-xs text-muted-foreground">اسم الجهاز المخزن في D1: <span className="font-bold text-foreground">{employee.deviceLabel || "غير مسجل"}</span></div>}
            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn-secondary text-xs" onClick={() => edit(employee)} disabled={saving}>تعديل</button>
              <button className="btn-secondary text-xs" onClick={() => void toggleStatus(employee)} disabled={saving}>{employee.status === "active" ? "إيقاف" : "تفعيل"}</button>
              <button className="btn-secondary text-xs" onClick={() => void resetDevice(employee)} disabled={saving || !employee.deviceId}>{employee.deviceId ? "فك ربط الجهاز" : "لا يوجد جهاز مربوط"}</button>
              <button className="text-xs px-3 py-2 rounded-lg bg-destructive/10 text-destructive font-bold" onClick={() => void remove(employee)} disabled={saving}>حذف من D1</button>
            </div>
          </div>)}
        </div>}
      </section>
    </div>
  </ManagerLayout>;
}
