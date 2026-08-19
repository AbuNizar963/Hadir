import { useMemo, useState, useRef } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import {
  getEmployees,
  saveEmployees,
  getAttendance,
  getSettings,
  forceCheckInByManager,
  getRequests,
  updateRequestStatus,
  EmployeeRequest,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, EmployeeStatus, ScheduleType } from "@/types";
import { addNotification } from "@/lib/notifications";

export default function ManageEmployees() {
  const [s] = useState(getSettings());
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [requests, setRequests] = useState<EmployeeRequest[]>(getRequests());
  const [name, setName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [locationId, setLocationId] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("ADMIN");
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [rotationStartDate, setRotationStartDate] = useState("");
  const [rotationPreset, setRotationPreset] = useState<"4/4" | "3/3" | "2/2" | "custom">("4/4");
  const [rotationDaysOn, setRotationDaysOn] = useState(4);
  const [rotationDaysOff, setRotationDaysOff] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attendance = useMemo(() => getAttendance(), [employees]);

  const resetForm = () => {
    setName(""); setJobNumber(""); setPin(""); setDeviceLabel(""); setAvatar(null);
    setLocationId(""); setScheduleType("ADMIN"); setWorkStartTime("08:00"); setWorkEndTime("16:00");
    setGracePeriodMinutes(15); setRotationStartDate(""); setRotationPreset("4/4");
    setRotationDaysOn(4); setRotationDaysOff(4);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("يرجى اختيار ملف صورة صالح (JPG/PNG/WEBP).");
    if (file.size > 500 * 1024) return setError("حجم الصورة يجب أن يكون أقل من 500 كيلوبايت.");
    const reader = new FileReader();
    reader.onload = () => { setAvatar(reader.result as string); setError(null); };
    reader.onerror = () => setError("تعذّر قراءة ملف الصورة.");
    reader.readAsDataURL(file);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    const cleanName = name.trim(); const cleanJob = jobNumber.trim();
    if (!cleanName || !cleanJob) return;
    if (employees.some((emp) => emp.jobNumber === cleanJob)) return setError("الرقم الوظيفي مسجل مسبقاً لموظف آخر.");
    if (scheduleType === "ROTATION" && !rotationStartDate) return setError("يرجى تحديد تاريخ بداية أول وردية للنظام التناوبي.");
    if (scheduleType === "ROTATION" && rotationDaysOn <= 0) return setError("عدد أيام العمل يجب أن يكون على الأقل 1.");
    if (scheduleType === "ROTATION" && rotationDaysOff < 0) return setError("عدد أيام الراحة لا يمكن أن يكون سالباً.");

    const effectivePin = pin.trim() || cleanJob;
    const newEmp: Employee = {
      id: generateId(), name: cleanName, jobNumber: cleanJob, pinHash: hash(effectivePin),
      status: "active", deviceId: null, deviceLabel: deviceLabel.trim() || null,
      createdAt: new Date().toISOString(), scheduleType, workStartTime, workEndTime,
      gracePeriodMinutes, rotationStartDate: scheduleType === "ROTATION" ? rotationStartDate : null,
      rotationDaysOn: scheduleType === "ROTATION" ? rotationDaysOn : undefined,
      rotationDaysOff: scheduleType === "ROTATION" ? rotationDaysOff : undefined,
      avatar, role: "staff", locationId: locationId || null, specialties: ["general"],
    };
    const updated = [newEmp, ...employees];
    setEmployees(updated); saveEmployees(updated);
    setSuccess(`تم إضافة الموظف "${newEmp.name}" بنجاح · كلمة المرور الافتراضية: ${effectivePin}`);
    resetForm(); setTimeout(() => setSuccess(null), 4000);
  };

  const handleDelete = (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الموظف؟ سيتم إلغاء توثيق جهازه تلقائياً.")) return;
    const updated = employees.filter((e) => e.id !== id); setEmployees(updated); saveEmployees(updated);
  };
  const handleResetDevice = (id: string) => {
    if (!confirm("هل تريد إعادة تعيين جهاز هذا الموظف؟ سيتمكن من تسجيل الدخول من جهاز جديد.")) return;
    const updated = employees.map((e) => e.id === id ? { ...e, deviceId: null, deviceLabel: null } : e);
    setEmployees(updated); saveEmployees(updated);
  };
  const toggleStatus = (id: string) => {
    const updated = employees.map((e) => e.id === id ? { ...e, status: (e.status === "active" ? "suspended" : "active") as EmployeeStatus } : e);
    setEmployees(updated); saveEmployees(updated);
  };
  const handleForceCheckIn = (emp: Employee) => {
    const checkIn = confirm(`اضغط "موافق" لتسجيل حضور الموظف ${emp.name}\nأو "إلغاء" لتسجيل الانصراف.`);
    const type = checkIn ? "check-in" : "check-out";
    forceCheckInByManager(emp, type);
    addNotification({ userId: emp.jobNumber, title: "تحديث حضور وانصراف", body: `قام المدير بتسجيل ${type === "check-in" ? "حضورك" : "انصرافك"} يدوياً.`, type: "info" });
    alert(`تم تسجيل ${type === "check-in" ? "حضور" : "انصراف"} الموظف ${emp.name} بنجاح.`);
  };
  const handleUpdateRequest = (req: EmployeeRequest, status: "approved" | "rejected") => {
    updateRequestStatus(req.id, status); setRequests(getRequests());
    const ok = status === "approved";
    const text = req.type === "permission" ? "استئذان الخروج المبكر" : req.type === "leave" ? "طلب الإجازة" : "طلب الانصراف المباشر";
    addNotification({ userId: req.jobNumber, title: ok ? "تمت الموافقة على طلبك" : "تم رفض طلبك", body: `تمت ${ok ? "الموافقة على" : "رفض"} ${text}.`, type: ok ? "success" : "error" });
  };

  return (
    <ManagerLayout title="إدارة الموظفين والطلبات" subtitle="إضافة الموظفين، التحضير اليدوي والموافقة على الطلبات">
      <div className="space-y-6">
        {requests.length > 0 && <section className="hud-card p-4 sm:p-5 border-2 border-primary/30">
          <h2 className="text-sm font-bold mb-3">📩 طلبات الموظفين المعلقة ({requests.filter(r => r.status === "pending").length})</h2>
          <div className="space-y-2.5">{requests.map(req => <div key={req.id} className="p-3 rounded-xl bg-secondary/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div><div className="font-bold text-sm">{req.employeeName} <span className="text-xs text-muted-foreground mono">({req.jobNumber})</span></div><div className="text-xs text-muted-foreground mt-0.5">{req.type === "permission" ? "استئذان خروج مبكر" : req.type === "leave" ? "طلب إجازة" : "انصراف مباشر"}{req.reason && ` · السبب: ${req.reason}`}</div></div>
            {req.status === "pending" ? <div className="flex gap-2"><button onClick={() => handleUpdateRequest(req,"approved")} className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg">موافقة</button><button onClick={() => handleUpdateRequest(req,"rejected")} className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">رفض</button></div> : <span className="text-xs font-bold">{req.status === "approved" ? "تمت الموافقة" : "مرفوض"}</span>}
          </div>)}</div>
        </section>}

        <form onSubmit={handleAdd} className="hud-card p-5 space-y-4">
          <div className="text-xs mono text-muted-foreground">ADD EMPLOYEE · إضافة موظف جديد</div>
          {error && <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg">{error}</div>}
          {success && <div className="p-3 text-xs bg-primary/10 text-primary rounded-lg">{success}</div>}
          <div className="flex items-center gap-4"><label className="relative cursor-pointer shrink-0">{avatar ? <img src={avatar} alt="avatar" className="h-16 w-16 rounded-full object-cover border-2 border-primary/50" /> : <div className="h-16 w-16 rounded-full bg-secondary/50 border-2 border-dashed border-border grid place-items-center"><CameraIcon /></div>}<input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" /></label><div className="text-xs text-muted-foreground"><div className="font-bold text-foreground text-sm">صورة الملف الشخصي</div><div>اختياري · JPG/PNG · بحد أقصى 500 كيلوبايت</div></div></div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="اسم الموظف *"><input className="input" value={name} onChange={e => setName(e.target.value)} required /></Field>
            <Field label="الرقم الوظيفي *"><input className="input mono" value={jobNumber} onChange={e => setJobNumber(e.target.value)} required /></Field>
            <Field label="رمز PIN (اختياري)"><input className="input mono" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="افتراضي: الرقم الوظيفي" /></Field>
            <Field label="موقع العمل المخصص"><select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">الموقع الرئيسي (الافتراضي)</option>{s.locations?.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></Field>
            <Field label="نوع الجدول / الدوام"><select className="input" value={scheduleType} onChange={e => setScheduleType(e.target.value as ScheduleType)}><option value="ADMIN">إداري (ثابت)</option><option value="ROTATION">تناوبي</option></select></Field>
            <Field label="وصف الجهاز (اختياري)"><input className="input" value={deviceLabel} onChange={e => setDeviceLabel(e.target.value)} placeholder="مثال: هاتف العمل" /></Field>
          </div>
          <div className="border-t border-border pt-4"><div className="text-xs font-bold text-muted-foreground mb-3">⏰ أوقات ومهلة الحضور الخاصة بالموظف</div><div className="grid sm:grid-cols-3 gap-4"><Field label="وقت بداية الدوام"><input type="time" className="input mono" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} required /></Field><Field label="وقت نهاية الدوام"><input type="time" className="input mono" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} required /></Field><Field label="مهلة التأخير المقبولة (بالدقائق)"><input type="number" min={0} max={120} className="input mono" value={gracePeriodMinutes} onChange={e => setGracePeriodMinutes(+e.target.value)} required /></Field></div></div>
          {scheduleType === "ROTATION" && <div className="border-t border-border pt-4 grid sm:grid-cols-2 md:grid-cols-4 gap-3 bg-secondary/20 p-3 rounded-lg"><Field label="تاريخ بداية التناوب *"><input type="date" className="input mono text-xs" value={rotationStartDate} onChange={e => setRotationStartDate(e.target.value)} required /></Field><Field label="نمط الوردية"><select className="input text-xs" value={rotationPreset} onChange={e => { const v=e.target.value as typeof rotationPreset; setRotationPreset(v); if(v==="4/4"){setRotationDaysOn(4);setRotationDaysOff(4)} if(v==="3/3"){setRotationDaysOn(3);setRotationDaysOff(3)} if(v==="2/2"){setRotationDaysOn(2);setRotationDaysOff(2)} }}><option value="4/4">4/4</option><option value="3/3">3/3</option><option value="2/2">2/2</option><option value="custom">مخصص</option></select></Field><Field label="أيام العمل"><input type="number" min={1} className="input mono text-xs" value={rotationDaysOn} onChange={e=>setRotationDaysOn(+e.target.value)} /></Field><Field label="أيام الراحة"><input type="number" min={0} className="input mono text-xs" value={rotationDaysOff} onChange={e=>setRotationDaysOff(+e.target.value)} /></Field></div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={resetForm} className="btn-secondary text-xs">إلغاء</button><button type="submit" className="btn-primary text-xs">+ إضافة الموظف</button></div>
        </form>

        <section className="hud-card p-4 sm:p-5"><h2 className="text-sm font-bold mb-4">قائمة الموظفين الحاليين ({employees.length})</h2><div className="space-y-3">{employees.length === 0 ? <div className="text-center py-6 text-sm text-muted-foreground">لا يوجد موظفون مسجلون حالياً.</div> : employees.map(emp => { const totalLogs=attendance.filter(r=>r.employeeId===emp.id).length; const assignedLoc=s.locations?.find(l=>l.id===emp.locationId); return <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 gap-3"><div className="flex items-start gap-3 min-w-0 flex-1">{emp.avatar ? <img src={emp.avatar} alt={emp.name} className="h-11 w-11 rounded-full object-cover border border-border shrink-0" /> : <div className="h-11 w-11 rounded-full bg-primary/15 border border-border grid place-items-center shrink-0"><span className="text-primary font-bold text-sm">{emp.name.charAt(0)}</span></div>}<div className="min-w-0 flex-1"><div className="font-bold text-sm flex flex-wrap items-center gap-1.5"><span className="truncate">{emp.name}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">موظف</span>{emp.scheduleType === "ROTATION" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">تناوبي {emp.rotationDaysOn ?? 4}/{emp.rotationDaysOff ?? 4}</span>}{emp.status === "suspended" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">موقوف</span>}</div><div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2"><span>رقم: <strong className="mono">{emp.jobNumber}</strong></span><span>·</span><span>الدوام: <strong className="mono text-foreground">{emp.workStartTime ?? "—"} → {emp.workEndTime ?? "—"}</strong></span><span>·</span><span>الموقع: <strong className="text-foreground">{assignedLoc ? assignedLoc.name : "الرئيسي"}</strong></span><span>·</span><span>الجهاز: <strong className={emp.deviceId ? "text-primary" : "text-muted-foreground"}>{emp.deviceLabel || "غير مربوط"}</strong></span><span>· العمليات: <strong className="mono">{totalLogs}</strong></span></div></div></div><div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0"><button onClick={()=>handleForceCheckIn(emp)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 font-bold">⚡ تحضير يدوي</button><button onClick={()=>toggleStatus(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 font-medium">{emp.status === "active" ? "إيقاف" : "تفعيل"}</button><button onClick={()=>handleResetDevice(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 font-medium">فك الجهاز</button><button onClick={()=>handleDelete(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive font-bold">حذف</button></div></div>})}</div></section>
      </div>
    </ManagerLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-muted-foreground mb-1">{label}</label>{children}</div>;
}
function CameraIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
