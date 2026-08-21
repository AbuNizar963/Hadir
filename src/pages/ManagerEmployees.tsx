import { useMemo, useState, useRef, useEffect } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getEmployees, saveEmployees, getAttendance, getSettings, forceCheckInByManager, getRequests, updateRequestStatus, EmployeeRequest } from "@/lib/storage";
import { backendEnabled, getBackendEmployees, getBackendLocations, saveBackendLocation, createBackendEmployee, updateBackendEmployee, deleteBackendEmployee, resetBackendEmployeeDevice, updateBackendRequest, getBackendRequests } from "@/lib/backend";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, EmployeeStatus, ScheduleType, Location } from "@/types";
import { addNotification } from "@/lib/notifications";

const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
type AdminPreset = "SUN_THU" | "SUN_WED" | "CUSTOM";
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const IMPORT_HEADERS = ["name", "jobNumber", "pin", "scheduleType", "workStartTime", "workEndTime", "gracePeriodMinutes", "rotationStartDate", "rotationDaysOn", "rotationDaysOff", "workDays", "locationId", "status", "deviceLabel"] as const;

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ',') { row.push(cell); cell = ""; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}
function downloadCsv(filename: string, rows: string[][]) {
  const csv = "\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function ManageEmployees() {
  const [s] = useState(getSettings());
  const [employees, setEmployees] = useState<Employee[]>(backendEnabled ? [] : getEmployees());
  const [locations, setLocations] = useState<Location[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>(getRequests());
  const [name, setName] = useState(""); const [jobNumber, setJobNumber] = useState(""); const [pin, setPin] = useState("");
  const [deviceLabel, setDeviceLabel] = useState(""); const [avatar, setAvatar] = useState<string | null>(null); const [locationId, setLocationId] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("ADMIN"); const [workStartTime, setWorkStartTime] = useState("08:00"); const [workEndTime, setWorkEndTime] = useState("16:00"); const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [rotationStartDate, setRotationStartDate] = useState(""); const [rotationPreset, setRotationPreset] = useState<"4/4" | "3/3" | "2/2" | "custom">("4/4"); const [rotationDaysOn, setRotationDaysOn] = useState(4); const [rotationDaysOff, setRotationDaysOff] = useState(4);
  const [adminPreset, setAdminPreset] = useState<AdminPreset>("SUN_THU"); const [adminDays, setAdminDays] = useState<number[]>([0,1,2,3,4]); const [adminDaysCount, setAdminDaysCount] = useState(5);
  const [editingId, setEditingId] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const [loadingD1, setLoadingD1] = useState(backendEnabled);
  const fileInputRef = useRef<HTMLInputElement>(null); const importInputRef = useRef<HTMLInputElement>(null); const [importing, setImporting] = useState(false); const attendance = useMemo(() => getAttendance(), [employees]);

  const refreshEmployeesFromD1 = async () => {
    if (!backendEnabled) return;
    setLoadingD1(true);
    try {
      setEmployees(await getBackendEmployees());
    } catch (error) {
      console.warn("Hadir manager D1 employee refresh failed:", error);
      setError(error instanceof Error ? error.message : "تعذر قراءة بيانات الموظفين من الخادم.");
    } finally {
      setLoadingD1(false);
    }
  };

  const refreshLocationsFromD1 = async () => {
    if (!backendEnabled) return;
    try {
      let remote = await getBackendLocations();
      if (!remote.some(location => location.id === "main")) {
        await saveBackendLocation({ id: "main", name: "المقر الرئيسي", lat: Number(s.workSiteLat), lng: Number(s.workSiteLng), radiusMeters: Number(s.radiusMeters) });
        remote = await getBackendLocations();
      }
      setLocations(remote);
      if (!locationId && remote.length) setLocationId(remote.find(l => l.id === "main")?.id || remote[0].id);
    } catch (error) {
      console.warn("Hadir manager D1 location refresh failed:", error);
      setLocations(s.locations || []);
    }
  };

  useEffect(() => {
    void refreshEmployeesFromD1(); void refreshLocationsFromD1();
    const refresh = () => { void refreshEmployeesFromD1(); void refreshLocationsFromD1(); setRequests(getRequests()); };
    window.addEventListener("hadir:cloud-data-changed", refresh); window.addEventListener("hadir:d1-view-changed", refresh); window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("hadir:cloud-data-changed", refresh); window.removeEventListener("hadir:d1-view-changed", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);

  const showSuccess = (message: string) => { setSuccess(message); window.setTimeout(() => setSuccess(null), 3000); };
  const resetForm = () => { setName(""); setJobNumber(""); setPin(""); setDeviceLabel(""); setAvatar(null); setLocationId(locations.find(l => l.id === "main")?.id || locations[0]?.id || ""); setScheduleType("ADMIN"); setWorkStartTime("08:00"); setWorkEndTime("16:00"); setGracePeriodMinutes(15); setRotationStartDate(""); setRotationPreset("4/4"); setRotationDaysOn(4); setRotationDaysOff(4); setAdminPreset("SUN_THU"); setAdminDays([0,1,2,3,4]); setAdminDaysCount(5); setEditingId(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const handleAdminPresetChange = (v: AdminPreset) => { setAdminPreset(v); if(v === "SUN_THU"){setAdminDays([0,1,2,3,4]);setAdminDaysCount(5);} if(v === "SUN_WED"){setAdminDays([0,1,2,3]);setAdminDaysCount(4);} if(v === "CUSTOM"){setAdminDays([]);setAdminDaysCount(0);} };
  const toggleAdminDay = (day: number) => { setAdminDays(prev => { const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b); setAdminDaysCount(next.length); return next; }); };
  const handleAvatarUpload = (e:React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/"))return setError("يرجى اختيار ملف صورة صالح (JPG/PNG/WEBP).");
    if(file.size>MAX_AVATAR_BYTES)return setError("حجم الصورة يجب أن يكون 10 ميغابايت أو أقل.");
    const reader=new FileReader(); reader.onload=()=>{setAvatar(reader.result as string);setError(null);}; reader.onerror=()=>setError("تعذّر قراءة ملف الصورة."); reader.readAsDataURL(file);
  };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setError(null); const cleanName=name.trim(); const cleanJob=jobNumber.trim();
    if(!cleanName||!cleanJob)return setError("يرجى إدخال اسم الموظف والرقم الوظيفي.");
    if(employees.some(emp=>emp.jobNumber===cleanJob&&emp.id!==editingId))return setError("الرقم الوظيفي مسجل مسبقاً لموظف آخر.");
    if(!locationId)return setError("يرجى اختيار المقر الرئيسي أو أحد المقرات الفرعية.");
    if(scheduleType==="ROTATION"&&!rotationStartDate)return setError("يرجى تحديد تاريخ بداية أول وردية للنظام التناوبي.");
    if(scheduleType==="ROTATION"&&rotationDaysOn<=0)return setError("عدد أيام العمل يجب أن يكون على الأقل 1.");
    if(scheduleType==="ROTATION"&&rotationDaysOff<0)return setError("عدد أيام الراحة لا يمكن أن يكون سالباً.");
    if(scheduleType==="ADMIN"&&adminDays.length!==adminDaysCount)return setError("يرجى تحديد أيام الدوام الإداري كاملة.");
    const existing=editingId?employees.find(emp=>emp.id===editingId):undefined; const effectivePin=pin.trim()||(existing?"":cleanJob);
    const scheduleTimes = { workStartTime: workStartTime || "08:00", workEndTime: workEndTime || "16:00" };
    const common={name:cleanName,jobNumber:cleanJob,status:(existing?.status??"active") as EmployeeStatus,deviceId:existing?.deviceId??null,deviceLabel:editingId?(existing?.deviceLabel??null):(deviceLabel.trim()||null),scheduleType,...scheduleTimes,gracePeriodMinutes,rotationStartDate:scheduleType==="ROTATION"?rotationStartDate:null,rotationDaysOn:scheduleType==="ROTATION"?rotationDaysOn:undefined,rotationDaysOff:scheduleType==="ROTATION"?rotationDaysOff:undefined,workDays:scheduleType==="ADMIN"?adminDays:undefined,avatar,role:"staff" as const,locationId,specialties:["general"]};
    try {
      if (backendEnabled) {
        if (editingId) await updateBackendEmployee(editingId, { ...common, ...(effectivePin ? { pin: effectivePin } : {}), deviceId: undefined, deviceLabel: undefined });
        else await createBackendEmployee({ ...common, pin: effectivePin, deviceId: null, deviceLabel: null });
        await refreshEmployeesFromD1(); await refreshLocationsFromD1(); resetForm(); showSuccess(editingId?"تم تعديل بيانات الموظف بنجاح":"تمت إضافة الموظف بنجاح"); return;
      }
      if(editingId&&existing){ const updatedEmployee:Employee={...existing,...common,pinHash:effectivePin?hash(effectivePin):existing.pinHash}; const updated=employees.map(emp=>emp.id===editingId?updatedEmployee:emp); setEmployees(updated);saveEmployees(updated,effectivePin?{[updatedEmployee.id]:effectivePin}:undefined);resetForm();showSuccess("تم تعديل بيانات الموظف بنجاح");return; }
      const newEmp:Employee={id:generateId(),pinHash:hash(effectivePin||cleanJob),createdAt:new Date().toISOString(),...common}; const updated=[newEmp,...employees]; setEmployees(updated);saveEmployees(updated,{[newEmp.id]:effectivePin||cleanJob});resetForm();showSuccess(`تمت إضافة الموظف "${newEmp.name}" بنجاح`);
    } catch (error) { setError(error instanceof Error?error.message:"تعذر حفظ بيانات الموظف"); }
  };

  const handleEdit=(emp:Employee)=>{setEditingId(emp.id);setName(emp.name);setJobNumber(emp.jobNumber);setPin("");setDeviceLabel(emp.deviceLabel||"");setAvatar(emp.avatar||null);setLocationId(emp.locationId||locations.find(l=>l.id==="main")?.id||"");setScheduleType(emp.scheduleType||"ADMIN");setWorkStartTime(emp.workStartTime||"08:00");setWorkEndTime(emp.workEndTime||"16:00");setGracePeriodMinutes(emp.gracePeriodMinutes??15);setRotationStartDate(emp.rotationStartDate||"");setRotationDaysOn(emp.rotationDaysOn??4);setRotationDaysOff(emp.rotationDaysOff??4);const days=emp.workDays?.length?emp.workDays:[0,1,2,3,4];setAdminDays(days);setAdminDaysCount(days.length);setAdminPreset(days.join(",")==="0,1,2,3,4"?"SUN_THU":days.join(",")==="0,1,2,3"?"SUN_WED":"CUSTOM");setError(null);window.scrollTo({top:0,behavior:"smooth"});};
  const handleDelete=async(id:string)=>{if(!confirm("هل أنت متأكد من حذف هذا الموظف؟ سيتم إلغاء توثيق جهازه تلقائياً."))return;try{if(backendEnabled){await deleteBackendEmployee(id);await refreshEmployeesFromD1();}else{const updated=employees.filter(e=>e.id!==id);setEmployees(updated);saveEmployees(updated);}showSuccess("تم حذف الموظف بنجاح");}catch(error){setError(error instanceof Error?error.message:"تعذر حذف الموظف");}};
  const handleResetDevice=async(id:string)=>{if(!confirm("هل تريد إعادة تعيين جهاز هذا الموظف؟ سيتمكن من تسجيل الدخول من جهاز جديد."))return;setError(null);try{if(backendEnabled){await resetBackendEmployeeDevice(id);await refreshEmployeesFromD1();}else{const updated=employees.map(e=>e.id===id?{...e,deviceId:null,deviceLabel:null}:e);setEmployees(updated);saveEmployees(updated);}showSuccess("تم فك ربط جهاز الموظف بنجاح");}catch(error){setError(error instanceof Error?error.message:"تعذر فك ربط الجهاز");}};
  const toggleStatus=async(id:string)=>{try{const emp=employees.find(e=>e.id===id);if(!emp)return;if(backendEnabled){await updateBackendEmployee(id,{status:emp.status==="active"?"suspended":"active"});await refreshEmployeesFromD1();}else{const updated=employees.map(e=>e.id===id?{...e,status:(e.status==="active"?"suspended":"active") as EmployeeStatus}:e);setEmployees(updated);saveEmployees(updated);}showSuccess("تم تحديث حالة الموظف بنجاح");}catch(error){setError(error instanceof Error?error.message:"تعذر تحديث حالة الموظف");}};
  const handleForceCheckIn=(emp:Employee)=>{const checkIn=confirm(`اضغط "موافق" لتسجيل حضور الموظف ${emp.name}\nأو "إلغاء" لتسجيل الانصراف.`);const type=checkIn?"check-in":"check-out";forceCheckInByManager(emp,type);addNotification({userId:emp.jobNumber,title:"تحديث حضور وانصراف",body:`قام المدير بتسجيل ${type==="check-in"?"حضورك":"انصرافك"} يدوياً.`,type:"info"});showSuccess(`تم تسجيل ${type==="check-in"?"حضور":"انصراف"} الموظف ${emp.name} بنجاح`);};
  const handleUpdateRequest=async(req:EmployeeRequest,status:"approved"|"rejected")=>{if(backendEnabled){await updateBackendRequest(req.id,status);setRequests(await getBackendRequests());}else{updateRequestStatus(req.id,status);setRequests(getRequests());}const ok=status==="approved";const text=req.type==="permission"?"استئذان الخروج المبكر":req.type==="leave"?"طلب الإجازة":"طلب الانصراف المباشر";addNotification({userId:req.jobNumber,title:ok?"تمت الموافقة على طلبك":"تم رفض طلبك",body:`تمت ${ok?"الموافقة على":"رفض"} ${text}.`,type:ok?"success":"error"});showSuccess(ok?"تمت الموافقة على الطلب":"تم رفض الطلب");};

  const exportEmployees = () => {
    const rows: string[][] = [
      [...IMPORT_HEADERS],
      ...employees.map(emp => [emp.name, emp.jobNumber, "", emp.scheduleType, emp.workStartTime || "", emp.workEndTime || "", String(emp.gracePeriodMinutes ?? 15), emp.rotationStartDate || "", String(emp.rotationDaysOn ?? ""), String(emp.rotationDaysOff ?? ""), (emp.workDays || []).join("|"), emp.locationId || "", emp.status || "active", emp.deviceLabel || ""])
    ];
    downloadCsv(`hadir-employees-${new Date().toISOString().slice(0,10)}.csv`, rows);
    showSuccess("تم تصدير قائمة الموظفين بنجاح");
  };

  const importEmployees = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setImporting(true); setError(null);
    try {
      if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes("csv") && !file.type.includes("text")) throw new Error("يرجى اختيار ملف CSV صالح.");
      const rows = parseCsv(await file.text()); if (rows.length < 2) throw new Error("الملف لا يحتوي على موظفين للاستيراد.");
      const headers = rows[0].map(h => h.trim());
      const index = (key: string) => headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
      if (index("name") < 0 || index("jobNumber") < 0) throw new Error("يجب أن يحتوي الملف على عمودي name و jobNumber.");
      const imported = rows.slice(1).map((row, n) => {
        const get = (key: string) => { const i = index(key); return i >= 0 ? (row[i] || "").trim() : ""; };
        const nameValue = get("name"), jobValue = get("jobNumber"); if (!nameValue || !jobValue) throw new Error(`السطر ${n + 2}: الاسم والرقم الوظيفي مطلوبان.`);
        const type = get("scheduleType") === "ROTATION" ? "ROTATION" : "ADMIN";
        return { name:nameValue, jobNumber:jobValue, pin:get("pin") || jobValue, scheduleType:type, workStartTime:get("workStartTime") || "08:00", workEndTime:get("workEndTime") || "16:00", gracePeriodMinutes:Number(get("gracePeriodMinutes")) || 15, rotationStartDate:get("rotationStartDate") || null, rotationDaysOn:type === "ROTATION" ? Number(get("rotationDaysOn")) || 4 : undefined, rotationDaysOff:type === "ROTATION" ? Number(get("rotationDaysOff")) : undefined, workDays:type === "ADMIN" ? (get("workDays") ? get("workDays").split("|").map(Number).filter(Number.isInteger) : [0,1,2,3,4]) : undefined, locationId:get("locationId") || locations.find(l => l.id === "main")?.id || locations[0]?.id || "", status:get("status") === "suspended" ? "suspended" : "active", deviceLabel:get("deviceLabel") || null };
      });
      const seen = new Set<string>(); const duplicate = imported.find(x => seen.has(x.jobNumber) || (seen.add(x.jobNumber), false)); if (duplicate) throw new Error(`الرقم الوظيفي مكرر داخل الملف: ${duplicate.jobNumber}`);
      const fresh = imported.filter(x => !employees.some(e => e.jobNumber === x.jobNumber));
      const conflicts = imported.length - fresh.length; if (conflicts && !confirm(`يوجد ${conflicts} موظفاً موجوداً مسبقاً. سيتم تجاهلهم واستيراد الموظفين الجدد فقط. هل تريد المتابعة؟`)) return;
      if (!fresh.length) { showSuccess("لا توجد سجلات جديدة للاستيراد."); return; }
      for (const item of fresh) {
        const payload = { name:item.name, jobNumber:item.jobNumber, pin:item.pin, status:item.status as EmployeeStatus, deviceId:null, deviceLabel:item.deviceLabel, scheduleType:item.scheduleType as ScheduleType, workStartTime:item.workStartTime, workEndTime:item.workEndTime, gracePeriodMinutes:item.gracePeriodMinutes, rotationStartDate:item.rotationStartDate, rotationDaysOn:item.rotationDaysOn, rotationDaysOff:item.rotationDaysOff, workDays:item.workDays, avatar:null, role:"staff" as const, locationId:item.locationId, specialties:["general"] };
        if (backendEnabled) await createBackendEmployee(payload);
        else { const local: Employee = { id:generateId(), pinHash:hash(item.pin), createdAt:new Date().toISOString(), ...payload }; setEmployees(prev => { const next=[local,...prev]; saveEmployees(next,{[local.id]:item.pin}); return next; }); }
      }
      if (backendEnabled) await refreshEmployeesFromD1(); showSuccess(`تم استيراد ${fresh.length} موظف بنجاح`);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر استيراد الملف."); }
    finally { setImporting(false); if (importInputRef.current) importInputRef.current.value = ""; }
  };

  return <ManagerLayout title="إدارة الموظفين والطلبات" subtitle="إضافة الموظفين، التحضير اليدوي والموافقة على الطلبات">
    {success&&<div className="fixed inset-0 z-[100] pointer-events-none grid place-items-center p-4"><div className="pointer-events-auto min-w-[280px] max-w-[90vw] rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-xl shadow-2xl px-6 py-4 text-center animate-in fade-in zoom-in-95"><div className="mx-auto mb-2 h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center text-lg">✓</div><div className="font-bold text-sm">{success}</div></div></div>}
    <div className="space-y-6">
      {requests.length>0&&<section className="hud-card p-4 sm:p-5 border-2 border-primary/30"><h2 className="text-sm font-bold mb-3">📩 طلبات الموظفين المعلقة ({requests.filter(r=>r.status==="pending").length})</h2><div className="space-y-2.5">{requests.map(req=><div key={req.id} className="p-3 rounded-xl bg-secondary/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"><div><div className="font-bold text-sm">{req.employeeName} <span className="text-xs text-muted-foreground mono">({req.jobNumber})</span></div><div className="text-xs text-muted-foreground mt-0.5">{req.type==="permission"?"استئذان خروج مبكر":req.type==="leave"?"طلب إجازة":"انصراف مباشر"}{req.reason&&` · السبب: ${req.reason}`}</div></div>{req.status==="pending"?<div className="flex gap-2"><button onClick={()=>handleUpdateRequest(req,"approved")} className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg">موافقة</button><button onClick={()=>handleUpdateRequest(req,"rejected")} className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">رفض</button></div>:<span className="text-xs font-bold">{req.status==="approved"?"تمت الموافقة":"مرفوض"}</span>}</div>)}</div></section>}
      <form onSubmit={handleSubmit} className="hud-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3"><div><div className="text-xs mono text-muted-foreground">{editingId?"EDIT EMPLOYEE · تعديل الموظف":"ADD EMPLOYEE · إضافة موظف جديد"}</div><div className="text-lg font-bold mt-1">{editingId?"تعديل بيانات الموظف":"إضافة موظف"}</div></div>{editingId&&<button type="button" onClick={resetForm} className="btn-secondary text-xs">إلغاء التعديل</button>}</div>
        {error&&<div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg">{error}</div>}
        {backendEnabled&&loadingD1&&<div className="p-3 text-xs rounded-lg bg-primary/10 text-primary">جاري تحميل بيانات الموظفين من الخادم…</div>}
        <div className="flex items-center gap-4"><label className="relative cursor-pointer shrink-0">{avatar?<img src={avatar} alt="avatar" className="h-16 w-16 rounded-full object-cover border-2 border-primary/50"/>:<div className="h-16 w-16 rounded-full bg-secondary/50 border-2 border-dashed border-border grid place-items-center"><CameraIcon/></div>}<input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/></label><div className="text-xs text-muted-foreground"><div className="font-bold text-foreground text-sm">صورة الملف الشخصي</div><div>اختياري · JPG/PNG/WEBP · بحد أقصى 10 ميغابايت · تحفظ في الخادم</div></div></div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4"><Field label="اسم الموظف *"><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></Field><Field label="الرقم الوظيفي *"><input className="input mono" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} required disabled={!!editingId}/></Field><Field label="رمز PIN (اختياري)"><input className="input mono" type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder={editingId?"اتركه فارغاً للإبقاء على الحالي":"افتراضي: الرقم الوظيفي"}/></Field><Field label="المقر"><select className="input" value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">اختر المقر</option>{locations.map(loc=><option key={loc.id} value={loc.id}>{loc.name}{loc.id==="main"?" (المقر الرئيسي)":" (مقر فرعي)"}</option>)}</select></Field><Field label="نوع الجدول / الدوام"><select className="input" value={scheduleType} onChange={e=>setScheduleType(e.target.value as ScheduleType)}><option value="ADMIN">إداري</option><option value="ROTATION">تناوبي</option></select></Field><Field label="وصف الجهاز (اختياري)"><input className="input" value={deviceLabel} onChange={e=>setDeviceLabel(e.target.value)} placeholder="مثال: هاتف العمل" disabled={!!editingId}/></Field></div>
        {scheduleType==="ADMIN"&&<div className="border-t border-border pt-4"><div className="text-xs font-bold text-muted-foreground mb-3">⏰ أوقات ومهلة الحضور الخاصة بالموظف</div><div className="grid sm:grid-cols-3 gap-4"><Field label="وقت بداية الدوام"><input type="time" className="input mono" value={workStartTime} onChange={e=>setWorkStartTime(e.target.value)} required/></Field><Field label="وقت نهاية الدوام"><input type="time" className="input mono" value={workEndTime} onChange={e=>setWorkEndTime(e.target.value)} required/></Field><Field label="مهلة التأخير المقبولة (بالدقائق)"><input type="number" min={0} max={120} className="input mono" value={gracePeriodMinutes} onChange={e=>setGracePeriodMinutes(+e.target.value)} required/></Field></div></div>}
        {scheduleType==="ADMIN"&&<div className="border-t border-border pt-4 space-y-3 bg-secondary/20 p-4 rounded-lg"><div className="text-xs font-bold">📅 أيام الدوام الإداري</div><div className="grid sm:grid-cols-2 gap-4"><Field label="نمط الدوام"><select className="input" value={adminPreset} onChange={e=>handleAdminPresetChange(e.target.value as AdminPreset)}><option value="SUN_THU">من الأحد إلى الخميس</option><option value="SUN_WED">من الأحد إلى الأربعاء</option><option value="CUSTOM">اختيار من قبلي</option></select></Field>{adminPreset==="CUSTOM"&&<div className="flex items-center rounded-lg border border-border bg-background px-3 py-2 self-end"><span className="text-xs text-muted-foreground">عدد أيام العمل:</span><strong className="mono mr-2 text-sm text-primary">{adminDays.length}</strong></div>}</div>{adminPreset==="CUSTOM"&&<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">{WEEK_DAYS.map((day,index)=><button key={day} type="button" onClick={()=>toggleAdminDay(index)} className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${adminDays.includes(index)?"border-primary bg-primary/15 text-primary":"border-border bg-background text-muted-foreground"}`}>{day}</button>)}</div>}<div className="text-[11px] text-muted-foreground">أيام الدوام المحددة: <strong className="text-foreground">{adminDays.map(d=>WEEK_DAYS[d]).join("، ")||"—"}</strong> · العدد: <strong className="text-foreground">{adminDays.length}</strong></div></div>}
        {scheduleType==="ROTATION"&&<div className="border-t border-border pt-4 space-y-3 bg-secondary/20 p-3 rounded-lg"><div className="text-xs font-bold">🔄 نظام التناوب</div><div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3"><Field label="تاريخ بداية التناوب *"><input type="date" className="input mono text-xs" value={rotationStartDate} onChange={e=>setRotationStartDate(e.target.value)} required/></Field><Field label="نمط الوردية"><select className="input text-xs" value={rotationPreset} onChange={e=>{const v=e.target.value as typeof rotationPreset;setRotationPreset(v);if(v==="4/4"){setRotationDaysOn(4);setRotationDaysOff(4)}if(v==="3/3"){setRotationDaysOn(3);setRotationDaysOff(3)}if(v==="2/2"){setRotationDaysOn(2);setRotationDaysOff(2)}}}><option value="4/4">4 أيام عمل / 4 راحة</option><option value="3/3">3 أيام عمل / 3 راحة</option><option value="2/2">2 يوم عمل / 2 راحة</option><option value="custom">مخصص</option></select></Field><Field label="بداية الوردية"><input type="time" className="input mono" value={workStartTime} onChange={e=>setWorkStartTime(e.target.value)} required/></Field><Field label="نهاية الوردية"><input type="time" className="input mono" value={workEndTime} onChange={e=>setWorkEndTime(e.target.value)} required/></Field></div><div className="text-[11px] text-muted-foreground">سيتم حفظ نوع الدوام والتناوب وأوقات الوردية مباشرة في الخادم، وستظهر نفس القيم في حساب الموظف.</div>{rotationPreset==="custom"&&<div className="grid sm:grid-cols-2 gap-3"><Field label="أيام العمل"><input type="number" min={1} className="input mono text-xs" value={rotationDaysOn} onChange={e=>setRotationDaysOn(+e.target.value)}/></Field><Field label="أيام الراحة"><input type="number" min={0} className="input mono text-xs" value={rotationDaysOff} onChange={e=>setRotationDaysOff(+e.target.value)}/></Field></div>}</div>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={resetForm} className="btn-secondary text-xs">إلغاء</button><button type="submit" className="btn-primary text-xs">{editingId?"حفظ التعديل":"+ إضافة الموظف"}</button></div>
      </form>
      <section className="hud-card p-4 sm:p-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"><h2 className="text-sm font-bold">قائمة الموظفين الحاليين ({employees.length})</h2><div className="flex flex-wrap gap-2"><input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importEmployees} className="hidden"/><button type="button" onClick={()=>importInputRef.current?.click()} className="btn-secondary text-xs" disabled={importing}>{importing?"جاري الاستيراد…":"استيراد ملف"}</button><button type="button" onClick={exportEmployees} className="btn-secondary text-xs" disabled={!employees.length}>تصدير ملف</button><button type="button" onClick={()=>{void refreshEmployeesFromD1();void refreshLocationsFromD1();}} className="btn-secondary text-xs" disabled={loadingD1}>{loadingD1?"جاري القراءة…":"تحديث من الخادم"}</button></div></div><div className="text-[11px] text-muted-foreground mb-3">صيغة الاستيراد: CSV. الأعمدة الأساسية: <span className="mono">name, jobNumber</span>، ويمكن إضافة بيانات الدوام والمقر والحالة.</div><div className="space-y-3">{loadingD1&&employees.length===0?<div className="text-center py-8 text-sm text-muted-foreground">جاري تحميل بيانات الموظفين من الخادم…</div>:employees.length===0?<div className="text-center py-6 text-sm text-muted-foreground">لا يوجد موظفون مسجلون حالياً.</div>:employees.map(emp=>{const totalLogs=attendance.filter(r=>r.employeeId===emp.id).length;const assignedLoc=locations.find(l=>l.id===emp.locationId);return <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 gap-3"><div className="flex items-start gap-3 min-w-0 flex-1">{emp.avatar?<img src={emp.avatar} alt={emp.name} className="h-11 w-11 rounded-full object-cover border border-border shrink-0"/>:<div className="h-11 w-11 rounded-full bg-primary/15 border border-border grid place-items-center shrink-0"><span className="text-primary font-bold text-sm">{emp.name.charAt(0)}</span></div>}<div className="min-w-0 flex-1"><div className="font-bold text-sm flex flex-wrap items-center gap-1.5"><span className="truncate">{emp.name}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">موظف</span>{emp.scheduleType==="ROTATION"&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">تناوبي {emp.rotationDaysOn??4}/{emp.rotationDaysOff??4}</span>}{emp.scheduleType==="ADMIN"&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">إداري · {emp.workDays?.length??5} أيام</span>}{emp.status==="suspended"&&<span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">موقوف</span>}</div><div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2"><span>رقم: <strong className="mono">{emp.jobNumber}</strong></span><span>·</span><span>الدوام: <strong className="mono text-foreground">{emp.workStartTime??"—"} → {emp.workEndTime??"—"}</strong></span><span>·</span><span>الموقع: <strong className="text-foreground">{assignedLoc?.name||"غير محدد"}</strong></span><span>·</span><span>الجهاز: <strong className={emp.deviceId?"text-primary":"text-muted-foreground"}>{emp.deviceId?"مربوط":"غير مربوط"}</strong>{emp.deviceId&&<span className="block text-[10px] mono break-all">{emp.deviceId}{emp.deviceLabel?` · ${emp.deviceLabel}`:""}</span>}</span><span>· العمليات: <strong className="mono">{totalLogs}</strong></span></div></div></div><div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0"><button onClick={()=>handleEdit(emp)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 font-bold">تعديل</button><button onClick={()=>handleForceCheckIn(emp)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 font-bold">⚡ تحضير يدوي</button><button onClick={()=>toggleStatus(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 font-medium">{emp.status==="active"?"إيقاف":"تفعيل"}</button><button onClick={()=>void handleResetDevice(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 font-medium">فك الجهاز</button><button onClick={()=>void handleDelete(emp.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive font-bold">حذف</button></div></div>})}</div></section>
    </div>
  </ManagerLayout>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="block text-xs text-muted-foreground mb-1">{label}</label>{children}</div>}
function CameraIcon(){return <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}