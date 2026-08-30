import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarPlus, FileClock, Star } from "lucide-react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import SmartEmployeeImport from "@/components/employees/SmartEmployeeImport";
import {
  backendEnabled,
  createBackendEmployee,
  createBackendEscapeEvent,
  deleteBackendEmployee,
  getBackendEmployees,
  getBackendEscapeEvents,
  getBackendLocations,
  resetBackendEmployeeDevice,
  updateBackendEmployee,
} from "@/lib/backend";
import { getEmployees, saveEmployees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, EscapeEvent, Location, ScheduleType } from "@/types";

type FormState = {
  name: string;
  jobNumber: string;
  pin: string;
  status: "active" | "suspended";
  scheduleType: ScheduleType;
  workStartTime: string;
  workEndTime: string;
  grace: string;
  earlyCheckoutGrace: string;
  workDays: number[];
  rotationDaysOn: number;
  rotationDaysOff: number;
  rotationStartDate: string;
  locationId: string;
  specialties: string;
};

const emptyForm: FormState = {
  name: "",
  jobNumber: "",
  pin: "",
  status: "active",
  scheduleType: "ADMIN",
  workStartTime: "08:00",
  workEndTime: "16:00",
  grace: "",
  earlyCheckoutGrace: "",
  workDays: [0, 1, 2, 3, 4],
  rotationDaysOn: 7,
  rotationDaysOff: 7,
  rotationStartDate: "",
  locationId: "",
  specialties: "general",
};

const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const rotationDays = Array.from({ length: 31 }, (_, i) => i + 1);

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("") || "م";
}

function formFrom(e: Employee): FormState {
  return {
    name: e.name,
    jobNumber: e.jobNumber,
    pin: "",
    status: e.status,
    scheduleType: e.scheduleType || "ADMIN",
    workStartTime: e.workStartTime || "08:00",
    workEndTime: e.workEndTime || "16:00",
    grace: e.gracePeriodMinutes == null ? "" : String(e.gracePeriodMinutes),
    earlyCheckoutGrace: e.earlyCheckoutGraceMinutes == null ? "" : String(e.earlyCheckoutGraceMinutes),
    workDays: e.workDays || [0, 1, 2, 3, 4],
    rotationDaysOn: e.rotationDaysOn ?? 7,
    rotationDaysOff: e.rotationDaysOff ?? 7,
    rotationStartDate: e.rotationStartDate || "",
    locationId: e.locationId || "",
    specialties: (e.specialties || []).join(", "),
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}

function EmployeeCardBase({ e, location, canManage, escapeStatus, onEdit, onRemove, onReset, onDirect, onCheckout, onWorkforceUpdate, isOwner, onEscape, onReturn, onRequest }: {
  e: Employee;
  location?: Location;
  canManage: boolean;
  escapeStatus: "escaped" | "returned" | "none";
  onEdit: (e: Employee) => void;
  onRemove: (e: Employee) => void;
  onReset: (e: Employee) => void;
  onDirect: (e: Employee) => void;
  onCheckout: (e: Employee) => void;
  onWorkforceUpdate: (e: Employee, patch: { isVip?: boolean; autoCheckIn?: boolean; autoCheckOut?: boolean }) => void;
  isOwner: boolean;
  onEscape: (e: Employee) => void;
  onReturn: (e: Employee) => void;
  onRequest: (e: Employee, type: "permission" | "leave") => void;
}) {
  const rotation = e.scheduleType === "ROTATION";
  const dotClass = escapeStatus === "escaped" ? "bg-destructive" : e.status !== "active" ? "bg-destructive" : e.deviceId ? "bg-primary" : "bg-[hsl(var(--warning))]";
  const dotStatus = escapeStatus === "escaped" ? "danger" : e.status !== "active" ? "danger" : e.deviceId ? "online" : "warning";
  return (
    <article className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {e.avatar ? <img src={e.avatar} alt="" className="h-10 w-10 rounded-xl border border-primary/20 object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-black text-primary">{initials(e.name)}</div>}
          <div className="min-w-0"><h3 className="truncate text-sm font-black">{e.name}</h3><div className="mono mt-0.5 text-[11px] text-muted-foreground">{e.jobNumber}</div></div>
        </div>
        <div className="flex items-center gap-1.5"><span className={`live-status-dot ${dotClass}`} data-status={dotStatus} title={escapeStatus === "escaped" ? "هارب" : e.status !== "active" ? "موقوف" : e.deviceId ? "نشط ومرتبط بالجهاز" : "نشط وغير مرتبط"} /><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${e.status === "active" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{e.status === "active" ? "فعال" : "موقوف"}</span>{e.isVip && <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-500">★ VIP</span>}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-xl border border-border/60 bg-background/30 p-2.5"><span className="text-muted-foreground">الدوام</span><div className="mt-0.5 font-bold">{rotation ? "تناوبي" : "إداري"}</div></div>
        <div className="rounded-xl border border-border/60 bg-background/30 p-2.5"><span className="text-muted-foreground">الموقع</span><div className="mt-0.5 truncate font-bold">{location?.name || "المقر الرئيسي"}</div></div>
        <div className="rounded-xl border border-border/60 bg-background/30 p-2.5"><span className="text-muted-foreground">الوقت</span><div className="mono mt-0.5 font-bold">{rotation ? `${e.rotationDaysOn ?? 0} عمل / ${e.rotationDaysOff ?? 0} راحة` : `${e.workStartTime || "--:--"} → ${e.workEndTime || "--:--"}`}</div></div>
        <div className="rounded-xl border border-border/60 bg-background/30 p-2.5"><span className="text-muted-foreground">الحالة الميدانية</span><div className={`mt-0.5 font-bold ${escapeStatus === "escaped" ? "text-destructive" : "text-primary"}`}>{escapeStatus === "escaped" ? "هارب من العمل" : escapeStatus === "returned" ? "عاد للعمل" : "طبيعي"}</div></div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>التأخير: {e.gracePeriodMinutes ?? 0} دقيقة</span><span>{e.earlyCheckoutGraceMinutes ? `الانصراف المبكر: ${e.earlyCheckoutGraceMinutes} دقيقة` : "الانصراف المبكر: بعد انتهاء الدوام"}</span></div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/20 p-2.5">
        <button type="button" disabled={!isOwner} onClick={() => { const enabled = !e.isVip; onWorkforceUpdate(e, { isVip: enabled, autoCheckIn: enabled, autoCheckOut: enabled }); }} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black transition ${e.isVip ? "border-amber-400/50 bg-amber-400/10 text-amber-500" : "border-border/70 bg-secondary/40 text-muted-foreground hover:bg-secondary"}`} title={e.isVip ? "VIP: التحضير والانصراف التلقائيان مفعّلان" : "تفعيل VIP مع التحضير والانصراف التلقائيين"}>
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          <span>VIP</span>
        </button>
        <span className="text-[10px] text-muted-foreground">{e.isVip ? "تحضير + انصراف تلقائي" : "تشغيل تلقائي عند التفعيل"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {canManage && e.status === "active" && <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/5 px-2.5 text-[11px] font-bold text-sky-700 hover:bg-sky-500/10 dark:text-sky-300" onClick={() => onRequest(e, "permission")} title="تسجيل استئذان"><FileClock className="h-3.5 w-3.5" aria-hidden="true" />إذن</button>}
        {canManage && e.status === "active" && <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/5 px-2.5 text-[11px] font-bold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300" onClick={() => onRequest(e, "leave")} title="تسجيل إجازة"><CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />إجازة</button>}
        {isOwner && e.status === "active" && <button type="button" className="btn-primary text-[11px]" onClick={() => onDirect(e)}>تحضير مباشر</button>}
        {isOwner && e.status === "active" && <button type="button" className="btn-secondary text-[11px]" onClick={() => onCheckout(e)}>انصراف مباشر</button>}
        {canManage && e.status === "active" && escapeStatus !== "escaped" && <button type="button" className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10" onClick={() => onEscape(e)}>هروب</button>}
        {canManage && escapeStatus === "escaped" && <button type="button" className="rounded-lg border border-primary/30 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/10" onClick={() => onReturn(e)}>إلغاء الهروب / عاد</button>}
        {canManage && <><button type="button" className="btn-secondary text-[11px]" onClick={() => onEdit(e)}>تعديل</button><button type="button" className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10" onClick={() => onRemove(e)}>حذف</button></>}
        {e.deviceId && <button type="button" className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary" onClick={() => onReset(e)}>فك ربط الهاتف</button>}
      </div>
    </article>
  );
}

const EmployeeCard = memo(EmployeeCardBase, (a, b) =>
  a.canManage === b.canManage && a.escapeStatus === b.escapeStatus && a.location?.name === b.location?.name && a.e.id === b.e.id && a.e.name === b.e.name && a.e.jobNumber === b.e.jobNumber && a.e.status === b.e.status && a.e.scheduleType === b.e.scheduleType && a.e.workStartTime === b.e.workStartTime && a.e.workEndTime === b.e.workEndTime && a.e.rotationDaysOn === b.e.rotationDaysOn && a.e.rotationDaysOff === b.e.rotationDaysOff && a.e.deviceId === b.e.deviceId && a.e.isVip === b.e.isVip && a.e.autoCheckIn === b.e.autoCheckIn && a.e.autoCheckOut === b.e.autoCheckOut && a.e.gracePeriodMinutes === b.e.gracePeriodMinutes && a.e.earlyCheckoutGraceMinutes === b.e.earlyCheckoutGraceMinutes && JSON.stringify(a.e.specialties) === JSON.stringify(b.e.specialties) && a.e.avatar === b.e.avatar,
);

export default function ManagerEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [escapeEvents, setEscapeEvents] = useState<EscapeEvent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "ADMIN" | "ROTATION">("all");
  const [role, setRole] = useState("manager");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const rows = backendEnabled ? await getBackendEmployees() : getEmployees();
      let next = Array.isArray(rows) ? rows : [];
      if (backendEnabled) {
        try {
          const token = localStorage.getItem("hadir.api.token.admin") || "";
          const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
          const response = await fetch(`${api}/api/manager/workforce-controls`, { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, credentials: "include", cache: "no-store" });
          const controls = await response.json().catch(() => []);
          if (response.ok && Array.isArray(controls)) {
            const byId = new Map(controls.map((control: any) => [String(control.id), control]));
            next = next.map((employee) => { const control = byId.get(String(employee.id)); if (!control) return employee; return { ...employee, isVip: Boolean(control.isVip), autoCheckIn: Boolean(control.autoCheckIn), autoCheckOut: Boolean(control.autoCheckOut) }; });
          }
          const policyResponse = await fetch(`${api}/api/employee-checkout-policies`, { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, credentials: "include", cache: "no-store" });
          const policies = await policyResponse.json().catch(() => []);
          if (policyResponse.ok && Array.isArray(policies)) {
            const byId = new Map(policies.map((policy: any) => [String(policy.id), Number(policy.earlyCheckoutMinutes) || 0]));
            next = next.map((employee) => ({ ...employee, earlyCheckoutGraceMinutes: byId.get(String(employee.id)) ?? employee.earlyCheckoutGraceMinutes ?? 0 }));
          }
        } catch {}
      }
      setEmployees((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
      if (backendEnabled) {
        try { const nextLocations = await getBackendLocations("admin"); setLocations((prev) => JSON.stringify(prev) === JSON.stringify(nextLocations) ? prev : nextLocations); } catch {}
        try { const nextEscapes = await getBackendEscapeEvents(undefined, 2000); setEscapeEvents((prev) => JSON.stringify(prev) === JSON.stringify(nextEscapes) ? prev : nextEscapes); } catch {}
      }
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر تحميل الموظفين من النظام."); }
    finally { if (showSpinner) setLoading(false); }
  }, []);

  useEffect(() => {
    void load(true);
    try { const raw = localStorage.getItem("hadir.manager_session"); const s = raw ? JSON.parse(raw) : null; if (s?.role) setRole(String(s.role)); } catch {}
    const timer = window.setInterval(() => void load(false), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((v) => ({ ...v, [key]: value })), []);
  const toggleDay = (day: number) => setForm((v) => ({ ...v, workDays: v.workDays.includes(day) ? v.workDays.filter((x) => x !== day) : [...v.workDays, day].sort() }));
  const canManage = role === "owner" || role === "manager";
  const isOwner = role === "owner";
  const canAdd = canManage || role === "supervisor";
  const escapeStatusFor = (employeeId: string): "escaped" | "returned" | "none" => { const latest = escapeEvents.find((x) => x.employeeId === employeeId); return latest?.status || "none"; };

  const changeEscape = async (e: Employee, status: "escaped" | "returned") => {
    const verb = status === "escaped" ? "تسجيل هروب" : "تسجيل عودة";
    const reason = window.prompt(`${verb} للموظف «${e.name}». اكتب السبب إن وجد:`);
    if (reason === null) return;
    setError(null);
    try {
      const created = await createBackendEscapeEvent({ employeeId: e.id, status, reason });
      setEscapeEvents((prev) => [created.event, ...prev.filter((x) => x.employeeId !== e.id)]);
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : `تعذر ${verb}.`); }
  };

  const createAdminEmployeeRequest = async (e: Employee, type: "permission" | "leave") => {
    if (!canManage || e.status !== "active") return;
    const label = type === "permission" ? "استئذان" : "إجازة";
    const reason = window.prompt(`تسجيل ${label} للموظف «${e.name}». اكتب السبب أو الملاحظة:`);
    if (reason === null) return;
    setError(null);
    try {
      const token = localStorage.getItem("hadir.api.token.admin") || "";
      const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
      const response = await fetch(`${api}/api/requests`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, credentials: "include", cache: "no-store", body: JSON.stringify({ employeeId: e.id, type, reason: reason.trim() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `تعذر تسجيل ${label}.`);
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : `تعذر تسجيل ${label}.`); }
  };

  const saveCheckoutPolicy = async (employeeId: string, minutes: number) => {
    const token = localStorage.getItem("hadir.api.token.admin") || "";
    const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
    const response = await fetch(`${api}/api/employees/${encodeURIComponent(employeeId)}/checkout-policy`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, credentials: "include", body: JSON.stringify({ earlyCheckoutMinutes: minutes }), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر حفظ فترة السماح بالانصراف المبكر.");
  };

  const submit = async () => {
    const name = form.name.trim(); const jobNumber = form.jobNumber.trim(); const pin = form.pin.trim();
    if (!name || !jobNumber) return setError("اسم الموظف والرقم الوظيفي مطلوبان.");
    if (!editingId && pin.length < 4) return setError("رمز PIN يجب أن يتكون من 4 أحرف/أرقام على الأقل.");
    if (form.scheduleType === "ADMIN" && !form.workDays.length) return setError("اختر يوم دوام واحدًا على الأقل.");
    setSaving(true); setError(null);
    try {
      const grace = form.grace.trim() === "" ? 0 : Math.max(0, Number(form.grace) || 0);
      const earlyCheckoutGrace = form.earlyCheckoutGrace.trim() === "" ? 0 : Math.min(1440, Math.max(0, Number(form.earlyCheckoutGrace) || 0));
      const specialties = form.specialties.split(",").map((x) => x.trim()).filter(Boolean);
      const payload: Record<string, unknown> = {
        name, jobNumber, status: form.status, scheduleType: form.scheduleType,
        workStartTime: form.workStartTime || null, workEndTime: form.workEndTime || null,
        gracePeriodMinutes: grace, workDays: form.workDays,
        rotationDaysOn: Math.max(1, Number(form.rotationDaysOn) || 7),
        rotationDaysOff: Math.max(0, Number(form.rotationDaysOff) || 7),
        rotationStartDate: form.rotationStartDate || null, locationId: form.locationId || null, specialties,
      };
      if (pin) payload.pin = pin;
      let savedEmployeeId = editingId;
      if (backendEnabled) {
        if (editingId) {
          const result = await updateBackendEmployee(editingId, payload);
          savedEmployeeId = result.employee?.id || editingId;
        } else {
          const created = await createBackendEmployee({ ...payload, pin, avatar: null });
          savedEmployeeId = created.employee?.id || null;
        }
        if (savedEmployeeId) await saveCheckoutPolicy(savedEmployeeId, earlyCheckoutGrace);
      } else if (editingId) {
        const current = employees.find((e) => e.id === editingId);
        if (!current) throw new Error("الموظف غير موجود.");
        saveEmployees(employees.map((e) => e.id === editingId ? ({ ...current, ...payload, gracePeriodMinutes: grace, earlyCheckoutGraceMinutes: earlyCheckoutGrace, ...(pin ? { pinHash: hash(pin) } : {}) } as Employee) : e));
      } else {
        const employee: Employee = {
          id: generateId(), name, jobNumber, pinHash: hash(pin), status: form.status,
          deviceId: null, deviceLabel: null, createdAt: new Date().toISOString(), role: "staff",
          scheduleType: form.scheduleType, workStartTime: form.workStartTime, workEndTime: form.workEndTime,
          gracePeriodMinutes: grace, earlyCheckoutGraceMinutes: earlyCheckoutGrace, workDays: form.workDays, rotationDaysOn: form.rotationDaysOn,
          rotationDaysOff: form.rotationDaysOff, rotationStartDate: form.rotationStartDate || null,
          locationId: form.locationId || null, specialties, avatar: null,
        };
        saveEmployees([employee, ...employees]);
      }
      setForm(emptyForm); setEditingId(null); setShowForm(false); await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ الموظف."); }
    finally { setSaving(false); }
  };

  const edit = (e: Employee) => { setEditingId(e.id); setForm(formFrom(e)); setShowForm(true); setError(null); };
  const remove = async (e: Employee) => {
    if (!confirm(`حذف الموظف «${e.name}»؟`)) return;
    try { if (backendEnabled) await deleteBackendEmployee(e.id); else saveEmployees(employees.filter((x) => x.id !== e.id)); await load(false); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر حذف الموظف."); }
  };
  const resetDevice = async (e: Employee) => {
    if (!confirm(`إلغاء ربط جهاز «${e.name}»؟`)) return;
    try { if (backendEnabled) await resetBackendEmployeeDevice(e.id); else saveEmployees(employees.map((x) => x.id === e.id ? { ...x, deviceId: null, deviceLabel: null } : x)); await load(false); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر إلغاء ربط الجهاز."); }
  };
  const directCheckout = async (e: Employee) => {
    if (e.status !== "active" || !isOwner) return;
    if (!confirm(`تسجيل انصراف مباشر للموظف «${e.name}»؟`)) return;
    try {
      const token = localStorage.getItem("hadir.api.token.admin") || "";
      const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
      const res = await fetch(`${api}/api/workforce/live`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ employeeId: e.id, type: "check-out" }), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر تسجيل الانصراف المباشر.");
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر تسجيل الانصراف المباشر."); }
  };
  const updateWorkforce = async (e: Employee, patch: { isVip?: boolean; autoCheckIn?: boolean; autoCheckOut?: boolean }) => {
    if (!isOwner) return;
    try {
      const token = localStorage.getItem("hadir.api.token.admin") || "";
      const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
      const res = await fetch(`${api}/api/workforce/live`, { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ employeeId: e.id, ...patch }), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر حفظ إعدادات Workforce.");
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ إعدادات Workforce."); await load(false); }
  };
  const direct = async (e: Employee) => {
    if (e.status !== "active" || !isOwner) return;
    if (!confirm(`تسجيل حضور مباشر للموظف «${e.name}» كمأمورية/مهمة؟`)) return;
    try {
      const token = localStorage.getItem("hadir.api.token.admin") || "";
      const api = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
      const res = await fetch(`${api}/api/manager/attendance`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ employeeId: e.id, type: "check-in" }), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذر تسجيل الحضور المباشر.");
      await load(false);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر تسجيل الحضور المباشر."); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => (!q || `${e.name} ${e.jobNumber} ${e.deviceLabel || ""}`.toLowerCase().includes(q)) && (statusFilter === "all" || e.status === statusFilter) && (scheduleFilter === "all" || e.scheduleType === scheduleFilter));
  }, [employees, query, statusFilter, scheduleFilter]);
  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    suspended: employees.filter((e) => e.status !== "active").length,
    devices: employees.filter((e) => !!e.deviceId).length,
    vip: employees.filter((e) => e.status === "active" && e.isVip).length,
    escaped: employees.filter((e) => escapeStatusFor(e.id) === "escaped").length,
  };

  return (
    <ManagerLayout title="الموظفون" subtitle="دليل الموظفين الموحد — البيانات من النظام مباشرة.">
      <div className="space-y-5">
        <section className="hud-card overflow-hidden border-primary/25 bg-primary/[0.025] p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="mono text-xs font-bold text-primary">EMPLOYEE DIRECTORY</div><h1 className="mt-1 text-2xl font-black">إدارة الموظفين</h1><p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">الواجهة ثابتة أثناء المزامنة؛ يتم تحديث القيم المتغيرة فقط.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setShowImport((v) => !v)}>{showImport ? "إغلاق الاستيراد" : "استيراد / تصدير"}</button>{canAdd && <button type="button" className="btn-primary" onClick={() => { setEditingId(null); setForm(emptyForm); setError(null); setShowForm((v) => !v); }}>{showForm ? "إغلاق النموذج" : "+ إضافة موظف"}</button>}</div></div></section>
        {showImport && <section className="hud-card p-5"><div className="mb-4"><div className="mono text-xs font-bold text-primary">SMART IMPORT</div><h2 className="mt-1 font-bold">استيراد وتصدير الموظفين</h2></div><SmartEmployeeImport onImported={() => void load(false)} /></section>}
        {showForm && (
          <section className={editingId ? "fixed inset-y-0 right-0 z-[70] w-full max-w-2xl overflow-y-auto rounded-none border-l border-border/80 bg-card p-5 shadow-2xl sm:p-6" : "hud-card p-5 sm:p-6"}>
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-3 border-b border-border/70 bg-card/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6"><div><div className="mono text-xs font-bold text-primary">EMPLOYEE FORM</div><h2 className="mt-1 text-lg font-black">{editingId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2><p className="mt-1 text-xs text-muted-foreground">الأدوار الإدارية تُدار من الإعدادات، وليس من هذه الصفحة.</p></div>{editingId && <button type="button" className="btn-secondary text-xs" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(false); }}>إلغاء</button>}</div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Field label="اسم الموظف"><input className="input w-full" placeholder="اكتب الاسم" value={form.name} onChange={(e) => setField("name", e.target.value)} /></Field><Field label="الرقم الوظيفي"><input className="input mono w-full" inputMode="numeric" placeholder="مثال: 1000" value={form.jobNumber} disabled={!!editingId} onChange={(e) => setField("jobNumber", e.target.value)} /></Field><Field label="رمز PIN" hint={editingId ? "اتركه فارغًا للإبقاء على الحالي." : "4 أحرف/أرقام على الأقل."}><input className="input mono w-full" type="password" placeholder={editingId ? "اختياري" : "أدخل PIN"} value={form.pin} onChange={(e) => setField("pin", e.target.value)} /></Field><Field label="الحالة"><select className="input w-full" value={form.status} onChange={(e) => setField("status", e.target.value as FormState["status"])}><option value="active">فعال</option><option value="suspended">موقوف</option></select></Field></div>
            <div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="نوع الدوام"><select className="input w-full" value={form.scheduleType} onChange={(e) => setField("scheduleType", e.target.value as ScheduleType)}><option value="ADMIN">إداري</option><option value="ROTATION">تناوبي</option></select></Field><Field label="بداية الدوام"><input className="input w-full" type="time" value={form.workStartTime} onChange={(e) => setField("workStartTime", e.target.value)} /></Field><Field label="نهاية الدوام"><input className="input w-full" type="time" value={form.workEndTime} onChange={(e) => setField("workEndTime", e.target.value)} /></Field></div>
            <div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="فترة السماح بالتأخير" hint="يبدأ الحقل فارغًا؛ اكتب 6 مباشرة وليس 06."><input className="input mono w-full" type="number" min="0" inputMode="numeric" placeholder="مثال: 6" value={form.grace} onChange={(e) => setField("grace", e.target.value)} /></Field><Field label="فترة السماح بالانصراف المبكر" hint="مثال: 60 = يسمح بالانصراف قبل نهاية الدوام بـ60 دقيقة دون طلب استئذان."><input className="input mono w-full" type="number" min="0" max="1440" inputMode="numeric" placeholder="مثال: 60" value={form.earlyCheckoutGrace} onChange={(e) => setField("earlyCheckoutGrace", e.target.value)} /></Field><Field label="موقع العمل"><select className="input w-full" value={form.locationId} onChange={(e) => setField("locationId", e.target.value)}><option value="">المقر الرئيسي</option>{locations.filter((l) => String(l.name || "").trim() !== "المقر الرئيسي").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="التخصصات"><input className="input w-full" placeholder="استقبال، موارد بشرية" value={form.specialties} onChange={(e) => setField("specialties", e.target.value)} /></Field><div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-[11px] leading-5 text-muted-foreground"><span className="font-bold text-foreground">قاعدة الانصراف:</span> إذا كانت القيمة 60 دقيقة ونهاية الدوام 16:00، يستطيع الموظف تسجيل الانصراف من 15:00. قبل ذلك يحتاج إلى موافقة الإدارة على طلب انصراف مبكر.</div></div>
            {form.scheduleType === "ADMIN" && <div className="mt-4"><div className="mb-2 text-xs font-bold">أيام الدوام</div><div className="flex flex-wrap gap-2">{days.map((d, i) => <button key={d} type="button" className={form.workDays.includes(i) ? "btn-primary text-xs" : "btn-secondary text-xs"} onClick={() => toggleDay(i)}>{d}</button>)}</div></div>}
            {form.scheduleType === "ROTATION" && <div className="mt-4 grid gap-4 rounded-2xl border border-border/60 bg-background/20 p-4 md:grid-cols-3"><Field label="أيام العمل"><select className="input w-full" value={form.rotationDaysOn} onChange={(e) => setField("rotationDaysOn", Number(e.target.value))}>{rotationDays.map((d) => <option key={d} value={d}>{d} يوم</option>)}</select></Field><Field label="أيام الراحة"><select className="input w-full" value={form.rotationDaysOff} onChange={(e) => setField("rotationDaysOff", Number(e.target.value))}><option value={0}>بدون راحة</option>{rotationDays.map((d) => <option key={d} value={d}>{d} يوم</option>)}</select></Field><Field label="تاريخ أول مناوبة"><input className="input w-full" type="date" value={form.rotationStartDate} onChange={(e) => setField("rotationStartDate", e.target.value)} /></Field></div>}
            <div className="sticky bottom-0 z-10 mt-5 -mx-5 flex justify-end border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur sm:-mx-6"><button type="button" className="btn-primary min-w-36" disabled={saving} onClick={() => void submit()}>{saving ? "جاري الحفظ…" : editingId ? "حفظ التعديل" : "إضافة الموظف"}</button></div>
            {error && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          </section>
        )}
        <section className="hud-card overflow-hidden border-primary/25 bg-primary/[0.025] p-5 sm:p-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-sky-700 dark:text-sky-300">الإجمالي</span><span className="live-status-dot bg-sky-400" data-status="info" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.total}</div></div>
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">فعال</span><span className="live-status-dot bg-emerald-400" data-status="online" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.active}</div></div>
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-rose-700 dark:text-rose-300">موقوف</span><span className="live-status-dot bg-rose-400" data-status="danger" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.suspended}</div></div>
          <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-violet-700 dark:text-violet-300">أجهزة موثقة</span><span className="live-status-dot bg-violet-400" data-status="info" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.devices}</div></div>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-amber-700 dark:text-amber-300">VIP مفعل</span><span className="live-status-dot bg-amber-400" data-status="vip" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.vip}</div></div>
          <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.07] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-red-700 dark:text-red-300">هارب الآن</span><span className="live-status-dot bg-red-400" data-status="danger" aria-hidden="true" /></div><div className="mono mt-2 text-2xl font-black text-foreground dark:text-white">{stats.escaped}</div></div>
        </div></section>
        <section className="hud-card overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="mono text-xs font-bold text-primary">LIVE DIRECTORY</div><h2 className="mt-1 text-lg font-black">قائمة الموظفين <span className="font-normal text-muted-foreground">({filtered.length})</span></h2><p className="mt-1 text-xs text-muted-foreground">{role === "supervisor" ? "المشرف: مشاهدة، إضافة، وفك ربط الهاتف فقط." : "المالك والمدير: إدارة الموظفين والتحضير المباشر للمهمات والمأموريات وتسجيل الهروب والعودة والأذونات والإجازات."}</p></div><div className="grid w-full gap-2 sm:grid-cols-[1fr_auto_auto] lg:w-auto"><input className="input lg:w-72" placeholder="بحث بالاسم أو الرقم أو الجهاز" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">كل الحالات</option><option value="active">فعال</option><option value="suspended">موقوف</option></select><select className="input" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value as typeof scheduleFilter)}><option value="all">كل أنواع الدوام</option><option value="ADMIN">إداري</option><option value="ROTATION">تناوبي</option></select></div></div>
          {loading ? <div className="py-16 text-center text-sm text-muted-foreground">جاري مزامنة الموظفين من قاعدة بيانات النظام…</div> : error && !showForm ? <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}<button type="button" className="mr-3 underline" onClick={() => void load(true)}>إعادة المحاولة</button></div> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-border/70 py-16 text-center"><div className="text-3xl">⌕</div><p className="mt-2 text-sm font-bold">لا توجد نتائج</p><p className="mt-1 text-xs text-muted-foreground">جرّب تغيير البحث أو الفلاتر.</p></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map((e) => <EmployeeCard key={e.id} e={e} location={locations.find((l) => String(l.id) === String(e.locationId)) || locations.find((l) => l.id === "main")} canManage={canManage} isOwner={isOwner} onCheckout={directCheckout} onWorkforceUpdate={updateWorkforce} escapeStatus={escapeStatusFor(e.id)} onEdit={edit} onRemove={remove} onReset={resetDevice} onDirect={direct} onEscape={(x) => void changeEscape(x, "escaped")} onReturn={(x) => void changeEscape(x, "returned")} onRequest={createAdminEmployeeRequest} />)}</div>}
        </section>
      </div>
    </ManagerLayout>
  );
}
