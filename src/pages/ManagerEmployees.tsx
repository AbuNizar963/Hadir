import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  rotationDaysOn: 7, rotationDaysOff: 7, rotationStartDate: "", locationId: "", specialties: "general"
};
const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const rotationDays = Array.from({ length: 31 }, (_, index) => index + 1);

function formFromEmployee(employee: Employee): FormState {
  return {
    name: employee.name, jobNumber: employee.jobNumber, pin: "", status: employee.status,
    role: employee.role || "staff", scheduleType: employee.scheduleType || "ADMIN",
    workStartTime: employee.workStartTime || "08:00", workEndTime: employee.workEndTime || "16:00",
    gracePeriodMinutes: employee.gracePeriodMinutes ?? 0, workDays: employee.workDays || [0, 1, 2, 3, 4],
    rotationDaysOn: employee.rotationDaysOn ?? 7, rotationDaysOff: employee.rotationDaysOff ?? 7,
    rotationStartDate: employee.rotationStartDate || "", locationId: employee.locationId || "",
    specialties: (employee.specialties || []).join(", ")
  };
}

type FieldProps = { label: string; children: ReactNode; hint?: string; className?: string };
function Field({ label, children, hint, className = "" }: FieldProps) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  );
}

type SectionProps = { number: string; title: string; description: string; children: ReactNode };
function Section({ number, title, description, children }: SectionProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/20 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="mono shrink-0 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary">{number}</div>
        <div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-[11px] text-muted-foreground">{description}</p></div>
      </div>
      {children}
    </div>
  );
}

type EmployeeTableProps = { rows: Employee[]; locations: Location[]; onEdit: (employee: Employee) => void; onRemove: (employee: Employee) => void; onResetDevice: (employee: Employee) => void };
function EmployeeTable({ rows, locations, onEdit, onRemove, onResetDevice }: EmployeeTableProps) {
  if (!rows.length) return <div className="py-7 text-center text-sm text-muted-foreground">لا توجد موظفين ضمن هذه القائمة.</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm"><thead><tr className="border-b bg-muted/20">
        <th className="p-3 text-right font-semibold">الموظف</th><th className="p-3 text-right font-semibold">الدوام</th>
        <th className="p-3 text-right font-semibold">الموقع</th><th className="p-3 text-right font-semibold">الهاتف / الجهاز</th>
        <th className="p-3 text-right font-semibold">الحالة</th><th className="p-3 text-right font-semibold">الإجراء</th>
      </tr></thead><tbody>
        {rows.map((employee) => {
          const location = locations.find((item) => String(item.id) === String(employee.locationId)) || locations.find((item) => item.id === "main");
          return <tr key={employee.id} className="border-b last:border-b-0 align-top hover:bg-muted/10">
            <td className="p-3"><div className="font-semibold">{employee.name}</div><div className="mono mt-0.5 text-xs text-muted-foreground">{employee.jobNumber}</div><div className="mt-1 text-[11px] text-muted-foreground">{employee.role === "manager" ? "مدير" : employee.role === "supervisor" ? "مشرف" : "موظف"}</div></td>
            <td className="p-3 text-xs"><div className="font-medium">{employee.scheduleType === "ROTATION" ? "تناوبي" : "إداري"}</div><div className="mt-1 text-muted-foreground">{employee.workStartTime || "--:--"} → {employee.workEndTime || "--:--"}</div><div className="mt-1 text-muted-foreground">سماح: {employee.gracePeriodMinutes ?? 0} د</div></td>
            <td className="p-3 text-xs">{location?.name || "المقر الرئيسي"}</td>
            <td className="p-3 text-xs"><div>{employee.deviceLabel || "غير مرتبط"}</div><div className="mono mt-1 text-[10px] text-muted-foreground">{employee.deviceId ? "جهاز موثق" : "لا يوجد جهاز"}</div>{employee.deviceId && <button type="button" className="mt-1 text-[11px] text-destructive" onClick={() => onResetDevice(employee)}>إلغاء ربط الجهاز</button>}</td>
            <td className="p-3"><span className="text-xs">{employee.status === "active" ? "فعال" : "موقوف"}</span></td>
            <td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary text-xs" onClick={() => onEdit(employee)}>تعديل</button><button type="button" className="text-xs text-destructive" onClick={() => onRemove(employee)}>حذف</button></div></td>
          </tr>;
        })}
      </tbody></table>
    </div>
  );
}

type ScheduleGroupProps = { title: string; subtitle: string; rows: Employee[]; open: boolean; onToggle: () => void; locations: Location[]; onEdit: (employee: Employee) => void; onRemove: (employee: Employee) => void; onResetDevice: (employee: Employee) => void };
function ScheduleGroup({ title, subtitle, rows, open, onToggle, locations, onEdit, onRemove, onResetDevice }: ScheduleGroupProps) {
  return <section className="overflow-hidden rounded-2xl border border-border/70">
    <button type="button" aria-expanded={open} className="flex w-full items-center justify-between gap-4 p-4 text-right transition-colors hover:bg-muted/10 sm:p-5" onClick={onToggle}>
      <span className="min-w-0"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{subtitle}</span></span>
      <span className="flex shrink-0 items-center gap-3"><span className="badge bg-primary/10 text-primary">{rows.length}</span><span className={`text-lg transition-transform ${open ? "rotate-180" : ""}`}>⌄</span></span>
    </button>
    {open && <div className="border-t border-border/60 bg-background/20 p-3 sm:p-4"><EmployeeTable rows={rows} locations={locations} onEdit={onEdit} onRemove={onRemove} onResetDevice={onResetDevice} /></div>}
  </section>;
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
  const [openGroups, setOpenGroups] = useState({ ADMIN: true, ROTATION: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(backendEnabled ? await getBackendEmployees() : getEmployees());
      if (backendEnabled) {
        try { setLocations(await getBackendLocations("admin")); } catch { setLocations([]); }
      }
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر تحميل الموظفين."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => { setForm((current) => ({ ...current, [key]: value })); }, []);
  const toggleDay = useCallback((day: number) => { setForm((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((item) => item !== day) : [...current.workDays, day].sort() })); }, []);

  const submit = async () => {
    const name = form.name.trim(); const jobNumber = form.jobNumber.trim(); const pin = form.pin.trim();
    if (!name || !jobNumber) { setError("اسم الموظف والرقم الوظيفي مطلوبان."); return; }
    if (!editingId && pin.length < 4) { setError("رمز PIN يجب أن يتكون من 4 أحرف/أرقام على الأقل."); return; }
    if (form.scheduleType === "ADMIN" && form.workDays.length === 0) { setError("اختر يوم دوام واحدًا على الأقل."); return; }
    setSaving(true); setError(null);
    try {
      const specialties = form.specialties.split(",").map((value) => value.trim()).filter(Boolean);
      const payload: Record<string, unknown> = { name, jobNumber, status: form.status, role: form.role, scheduleType: form.scheduleType, workStartTime: form.workStartTime || null, workEndTime: form.workEndTime || null, gracePeriodMinutes: Math.max(0, Number(form.gracePeriodMinutes) || 0), workDays: form.workDays, rotationDaysOn: Math.max(1, Number(form.rotationDaysOn) || 7), rotationDaysOff: Math.max(0, Number(form.rotationDaysOff) || 7), rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties };
      if (pin) payload.pin = pin;
      if (backendEnabled) {
        if (editingId) await updateBackendEmployee(editingId, payload); else await createBackendEmployee({ ...payload, pin, avatar: null });
      } else if (editingId) {
        const current = employees.find((employee) => employee.id === editingId); if (!current) throw new Error("الموظف غير موجود.");
        const updated = { ...current, ...payload, jobNumber: current.jobNumber, ...(pin ? { pinHash: hash(pin) } : {}) } as Employee;
        saveEmployees(employees.map((employee) => employee.id === editingId ? updated : employee));
      } else {
        const employee: Employee = { id: generateId(), name, jobNumber, pinHash: hash(pin), status: form.status, deviceId: null, deviceLabel: null, createdAt: new Date().toISOString(), role: form.role, scheduleType: form.scheduleType, workStartTime: form.workStartTime, workEndTime: form.workEndTime, gracePeriodMinutes: form.gracePeriodMinutes, workDays: form.workDays, rotationDaysOn: form.rotationDaysOn, rotationDaysOff: form.rotationDaysOff, rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties, avatar: null };
        saveEmployees([employee, ...employees]);
      }
      setForm(emptyForm); setEditingId(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ الموظف."); }
    finally { setSaving(false); }
  };

  const edit = (employee: Employee) => { setEditingId(employee.id); setForm(formFromEmployee(employee)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = async (employee: Employee) => { if (!confirm(`حذف الموظف «${employee.name}»؟`)) return; try { if (backendEnabled) await deleteBackendEmployee(employee.id); else saveEmployees(employees.filter((item) => item.id !== employee.id)); await load(); } catch (err) { setError(err instanceof Error ? err.message : "تعذر حذف الموظف."); } };
  const resetDevice = async (employee: Employee) => { if (!confirm(`إلغاء ربط جهاز «${employee.name}»؟ سيتمكن الموظف من ربط جهاز جديد عند تسجيل الدخول.`)) return; try { if (backendEnabled) await resetBackendEmployeeDevice(employee.id); else saveEmployees(employees.map((item) => item.id === employee.id ? { ...item, deviceId: null, deviceLabel: null } : item)); await load(); } catch (err) { setError(err instanceof Error ? err.message : "تعذر إلغاء ربط الجهاز."); } };

  const search = query.trim().toLowerCase();
  const visible = employees.filter((employee) => `${employee.name} ${employee.jobNumber} ${employee.deviceLabel || ""}`.toLowerCase().includes(search));
  const adminEmployees = visible.filter((employee) => employee.scheduleType !== "ROTATION");
  const rotationEmployees = visible.filter((employee) => employee.scheduleType === "ROTATION");
  const commonTableProps = { locations, onEdit: edit, onRemove: remove, onResetDevice: resetDevice };

  return <ManagerLayout title="الموظفون" subtitle="إدارة حسابات الموظفين وبياناتهم من قاعدة بيانات D1"><div className="space-y-5">
    <section className="hud-card p-5"><div className="mb-3"><div className="mono text-xs font-bold text-primary">SMART IMPORT · استيراد Excel / CSV</div><p className="mt-1 text-xs text-muted-foreground">إضافة مجموعة موظفين دفعة واحدة مع الحفاظ على بيانات الدوام.</p></div><SmartEmployeeImport onImported={() => void load()} /></section>
    <section className="hud-card p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="mono mb-1 text-xs font-bold text-primary">EMPLOYEE PROFILE</div><h2 className="text-base font-bold">{editingId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2><p className="mt-1 text-xs text-muted-foreground">نموذج منظم مع الحفاظ على شكل النظام الحالي.</p></div>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>إلغاء التعديل</button>}</div>
      <div className="space-y-3">
        <Section number="01" title="بيانات الموظف" description="المعلومات الأساسية التي يستخدمها الموظف لتسجيل الدخول."><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="اسم الموظف"><input className="input w-full" autoComplete="name" autoCorrect="off" spellCheck={false} placeholder="اكتب اسم الموظف" value={form.name} onChange={(event) => setField("name", event.target.value)} /></Field>
          <Field label="الرقم الوظيفي"><input className="input mono w-full" inputMode="numeric" autoComplete="off" placeholder="مثال: 1000" value={form.jobNumber} disabled={Boolean(editingId)} onChange={(event) => setField("jobNumber", event.target.value)} /></Field>
          <Field label="رمز PIN" hint={editingId ? "اتركه فارغًا للإبقاء على PIN الحالي." : "يُحفظ بشكل آمن ولا يظهر في قائمة الموظفين."}><input className="input mono w-full" type="password" inputMode="text" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder={editingId ? "PIN جديد (اختياري)" : "أدخل PIN"} value={form.pin} onChange={(event) => setField("pin", event.target.value)} /></Field>
          <Field label="حالة الموظف"><select className="input w-full" value={form.status} onChange={(event) => setField("status", event.target.value as FormState["status"])}><option value="active">فعال</option><option value="suspended">موقوف</option></select></Field>
        </div></Section>
        <Section number="02" title="الصلاحية ونوع الدوام" description="حدد صلاحية الحساب ونظام الدوام قبل ضبط أوقاته."><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="الصلاحية"><select className="input w-full" value={form.role} onChange={(event) => setField("role", event.target.value as UserRole)}><option value="staff">موظف</option><option value="supervisor">مشرف</option><option value="manager">مدير</option></select></Field>
          <Field label="نوع الدوام"><div className="flex h-10 flex-row gap-2"><button type="button" aria-pressed={form.scheduleType === "ADMIN"} className={`flex-1 text-sm ${form.scheduleType === "ADMIN" ? "btn-primary" : "btn-secondary"}`} onClick={() => setField("scheduleType", "ADMIN")}>إداري</button><button type="button" aria-pressed={form.scheduleType === "ROTATION"} className={`flex-1 text-sm ${form.scheduleType === "ROTATION" ? "btn-primary" : "btn-secondary"}`} onClick={() => setField("scheduleType", "ROTATION")}>تناوبي</button></div></Field>
          <Field label="بداية الدوام"><input className="input w-full" type="time" value={form.workStartTime} onChange={(event) => setField("workStartTime", event.target.value)} /></Field>
          <Field label="نهاية الدوام"><input className="input w-full" type="time" value={form.workEndTime} onChange={(event) => setField("workEndTime", event.target.value)} /></Field>
        </div></Section>
        <Section number="03" title="الدوام وموقع العمل" description="اضبط السماح بالتأخير، الموقع، التخصصات وأيام العمل."><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="فترة السماح بالتأخير"><input className="input w-full" type="number" inputMode="numeric" min="0" value={form.gracePeriodMinutes} onChange={(event) => setField("gracePeriodMinutes", Number(event.target.value))} /></Field>
          <Field label="موقع العمل"><select className="input w-full" value={form.locationId} onChange={(event) => setField("locationId", event.target.value)}><option value="">المقر الرئيسي</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></Field>
          <Field label="التخصصات" className="sm:col-span-2" hint="افصل بين أكثر من تخصص بفاصلة."><input className="input w-full" autoComplete="off" placeholder="مثال: تمريض، استقبال" value={form.specialties} onChange={(event) => setField("specialties", event.target.value)} /></Field>
        </div><div className="mt-5"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold">أيام الدوام</span><span className="text-[11px] text-muted-foreground">{form.workDays.length} أيام محددة</span></div><div className="flex flex-row flex-wrap gap-2">{dayNames.map((day, index) => <button key={day} type="button" aria-pressed={form.workDays.includes(index)} className={form.workDays.includes(index) ? "btn-primary text-xs" : "btn-secondary text-xs"} onClick={() => toggleDay(index)}>{day}</button>)}</div></div></Section>
        {form.scheduleType === "ROTATION" && <Section number="04" title="الدوام التناوبي" description="حدد دورة العمل والراحة ونقطة بداية أول مناوبة للموظف."><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Field label="أيام العمل في المناوبة" hint="عدد أيام العمل قبل الانتقال إلى الراحة."><select className="input w-full" value={form.rotationDaysOn} onChange={(event) => setField("rotationDaysOn", Number(event.target.value))}>{rotationDays.map((day) => <option key={day} value={day}>{day} يوم</option>)}</select></Field><Field label="أيام الراحة بعد المناوبة" hint="اختر 0 إذا لم توجد فترة راحة محددة."><select className="input w-full" value={form.rotationDaysOff} onChange={(event) => setField("rotationDaysOff", Number(event.target.value))}><option value={0}>بدون راحة</option>{rotationDays.map((day) => <option key={day} value={day}>{day} يوم</option>)}</select></Field><Field label="تاريخ أول مناوبة (اختياري)" hint="هذا هو اليوم الذي تبدأ منه أول مناوبة للموظف."><input className="input w-full" type="date" value={form.rotationStartDate} onChange={(event) => setField("rotationStartDate", event.target.value)} /></Field></div></Section>}
      </div>
      <div className="mt-5 flex justify-end border-t border-border/60 pt-4"><button type="button" className="btn-primary min-w-32" disabled={saving} onClick={() => void submit()}>{saving ? "جاري الحفظ…" : editingId ? "حفظ التعديل" : "إضافة الموظف"}</button></div>{error && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    </section>
    <section className="hud-card p-5"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="mono mb-1 text-xs font-bold text-primary">EMPLOYEE DIRECTORY</div><h2 className="font-bold">قائمة الموظفين <span className="font-normal text-muted-foreground">({visible.length})</span></h2><p className="mt-1 text-xs text-muted-foreground">اختر نوع الدوام لعرض الموظفين.</p></div><Field label="بحث الموظفين" className="w-full sm:w-72"><input className="input w-full" placeholder="الاسم أو الرقم أو الجهاز" value={query} onChange={(event) => setQuery(event.target.value)} /></Field></div>{loading ? <div className="py-8 text-center text-sm text-muted-foreground">جاري تحميل الموظفين من الخادم…</div> : <div className="space-y-3"><ScheduleGroup title="الموظفون الإداريون" subtitle="موظفو الدوام الإداري وأوقات دوامهم ومواقعهم" rows={adminEmployees} open={openGroups.ADMIN} onToggle={() => setOpenGroups((current) => ({ ...current, ADMIN: !current.ADMIN }))} {...commonTableProps} /><ScheduleGroup title="الموظفون التناوبيون" subtitle="موظفو المناوبات ودورة العمل والراحة" rows={rotationEmployees} open={openGroups.ROTATION} onToggle={() => setOpenGroups((current) => ({ ...current, ROTATION: !current.ROTATION }))} {...commonTableProps} /></div>}</section>
  </div></ManagerLayout>;
}
