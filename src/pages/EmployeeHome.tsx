import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession, logoutEmployee } from "@/lib/auth";
import { getSettings, isShiftOver, type RequestType } from "@/lib/storage";
import { backendEnabled, getBackendEmployeeProfile, getBackendAttendance, getBackendLocations, createBackendRequest } from "@/lib/backend";
import { getEmployeeScheduleStatus } from "@/lib/schedule";
import { formatTime, formatDurationMinutes, todayKey, minutesBetween } from "@/lib/utils";
import type { AttendanceRecord, Employee, Location } from "@/types";

export default function EmployeeHome() {
  const nav = useNavigate();
  const session = currentSession();
  const [now, setNow] = useState(new Date());
  const [emp, setEmp] = useState<Employee | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("permission");
  const [reason, setReason] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!session) { nav("/login", { replace: true }); return; }
    let cancelled = false;
    const loadFromD1 = async () => {
      setLoadingProfile(true);
      setProfileError(null);
      if (!backendEnabled) { setProfileError("خادم D1 غير مفعّل."); setLoadingProfile(false); return; }
      try {
        // ملف الموظف هو المصدر الإلزامي. لا تجعل فشل الحضور أو المواقع يمنع فتح الصفحة.
        const profile = await getBackendEmployeeProfile();
        if (cancelled) return;
        setEmp(profile);
        setProfileError(null);
        setLoadingProfile(false);

        // البيانات الإضافية تُحمّل بعد الملف بشكل مستقل.
        const [attendanceResult, locationsResult] = await Promise.allSettled([
          getBackendAttendance(500),
          getBackendLocations(),
        ]);
        if (cancelled) return;
        if (attendanceResult.status === "fulfilled") setAttendance(attendanceResult.value);
        if (locationsResult.status === "fulfilled") setLocations(locationsResult.value);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "تعذر تحميل بيانات الموظف من D1.";
        setProfileError(message);
        setEmp(null);
        setLoadingProfile(false);
      }
    };
    void loadFromD1();
    const refresh = () => { void loadFromD1(); };
    window.addEventListener("hadir:cloud-data-changed", refresh);
    window.addEventListener("hadir:d1-view-changed", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { cancelled = true; window.removeEventListener("hadir:cloud-data-changed", refresh); window.removeEventListener("hadir:d1-view-changed", refresh); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [session, nav]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const settings = getSettings();
  const assignedLocation = useMemo(() => emp?.locationId ? locations.find((loc) => loc.id === emp.locationId) || null : null, [emp, locations]);
  const scheduleStatus = useMemo(() => getEmployeeScheduleStatus(emp, now), [emp, now]);
  const isWorkDay = scheduleStatus.isWorkDay;
  const todays = useMemo(() => attendance.filter((r) => r.employeeId === emp?.id && r.timestamp.startsWith(todayKey())), [attendance, emp]);
  const checkIn = todays.find((r) => r.type === "check-in" || r.type === "in");
  const checkOut = todays.find((r) => r.type === "check-out" || r.type === "out");
  const workedMinutes = checkIn ? minutesBetween(checkIn.timestamp, checkOut?.timestamp ?? new Date().toISOString()) : 0;
  const workStartTime = emp?.workStartTime || settings.workStart || "08:00";
  const [hh, mm] = workStartTime.split(":").map(Number);
  let lateMinutes = 0;
  if (checkIn) { const scheduled = new Date(checkIn.timestamp); scheduled.setHours(hh, mm, 0, 0); const diff = Math.round((new Date(checkIn.timestamp).getTime() - scheduled.getTime()) / 60000); const grace = emp?.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10; lateMinutes = Math.max(0, diff - grace); }
  const shiftEnded = isShiftOver(emp);
  const logout = () => { logoutEmployee(); nav("/login"); };
  const canCheckIn = isWorkDay && !checkIn;
  const canCheckOut = isWorkDay && !!checkIn && !checkOut && shiftEnded;

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault(); if (!emp) return;
    try { if (!backendEnabled) throw new Error("خادم D1 غير مفعّل."); await createBackendRequest({ employeeId: emp.id, employeeName: emp.name, jobNumber: emp.jobNumber, type: requestType, reason }); setRequestSent(true); setTimeout(() => { setRequestSent(false); setShowRequestModal(false); setReason(""); }, 2000); }
    catch (error) { setProfileError(error instanceof Error ? error.message : "تعذر إرسال الطلب إلى D1."); }
  };

  if (!session) return null;
  if (loadingProfile) return <div className="min-h-screen grid place-items-center px-5"><div className="hud-card w-full max-w-md p-7 text-center"><Brand /><div className="mt-5 font-bold">جاري تحميل بيانات الموظف من D1...</div><div className="text-xs text-muted-foreground mt-2">يتم جلب ملف الموظف المرتبط بحسابك مباشرة من قاعدة البيانات.</div></div></div>;
  if (profileError || !emp) return <div className="min-h-screen grid place-items-center px-5"><div className="hud-card w-full max-w-md p-7 text-center"><Brand /><div className="mt-5 font-bold">تعذر تحميل بيانات الموظف</div><div className="text-sm text-muted-foreground mt-2">{profileError || "لم يتم العثور على ملف الموظف في D1."}</div><div className="flex gap-2 mt-5"><button onClick={() => window.location.reload()} className="btn-primary flex-1 py-2.5 rounded-xl">إعادة المحاولة</button><button onClick={logout} className="btn-ghost flex-1 py-2.5 rounded-xl">تسجيل الخروج</button></div></div></div>;

  return (<div className="min-h-screen">
    <header className="max-w-xl mx-auto px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-between"><Brand /><button onClick={logout} className="btn-ghost text-xs">خروج</button></header>
    <main className="max-w-xl mx-auto px-4 sm:px-5 pb-16 space-y-4 sm:space-y-5">
      <section className="hud-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3 sm:gap-4"><div className="flex items-center gap-3 min-w-0 flex-1">{emp.avatar ? <img src={emp.avatar} alt={emp.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-2 border-primary/40 shrink-0" /> : <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/15 grid place-items-center border-2 border-primary/30 shrink-0"><span className="text-primary font-extrabold text-lg sm:text-xl">{emp.name ? emp.name.charAt(0) : "م"}</span></div>}<div className="min-w-0"><div className="text-[10px] text-muted-foreground mono">EMPLOYEE</div><div className="text-base sm:text-xl font-extrabold mt-0.5 truncate">{emp.name}</div><div className="text-[11px] sm:text-xs text-muted-foreground mono mt-0.5">رقم وظيفي: {emp.jobNumber}</div></div></div><div className="text-left shrink-0"><div className="mono text-xl sm:text-3xl font-extrabold tabular-nums">{now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })}</div><div className="text-[10px] sm:text-xs text-muted-foreground mono">{now.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "2-digit" })}</div></div></div><div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 text-center"><Stat label="الحضور" value={checkIn ? formatTime(checkIn.timestamp) : "—"} /><Stat label="الانصراف" value={checkOut ? formatTime(checkOut.timestamp) : "—"} /><Stat label="ساعات العمل" value={formatDurationMinutes(workedMinutes)} /></div>{!isWorkDay && <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs sm:text-sm text-accent font-semibold flex items-center gap-2"><RestIcon /><span>{scheduleStatus.label} — استمتع بيومك بلا التزامات دوام.</span></div>}{isWorkDay && lateMinutes > 0 && <div className="mt-4 rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3 text-xs text-[hsl(var(--warning))] font-semibold">تم رصد تأخر {lateMinutes} دقيقة عن بداية الدوام ({workStartTime}).</div>}</section>
      <section className="grid grid-cols-2 gap-3"><Link to="/employee/scan/check-in" aria-disabled={!canCheckIn} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckIn ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/15 grid place-items-center mb-2 signal-ring"><ArrowIn /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل حضور</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{!isWorkDay ? "أنت في يوم راحة (Off)" : checkIn ? "تم بالفعل اليوم" : "امسح رمز QR داخل المقر"}</div></Link>{shiftEnded ? <Link to="/employee/scan/check-out" aria-disabled={!canCheckOut} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckOut ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-accent/15 grid place-items-center mb-2"><ArrowOut /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل انصراف</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{checkOut ? "تم بالفعل اليوم" : "انتهى الدوام، امسح QR للانصراف"}</div></Link> : <button onClick={() => setShowRequestModal(true)} className="hud-card p-4 sm:p-5 text-center transition hover:brightness-110 border-dashed border-accent/40"><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-accent/10 grid place-items-center mb-2"><ArrowOut /></div><div className="font-extrabold text-sm sm:text-lg text-accent">طلب استئذان / إجازة</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">الدوام لم ينتهِ بعد، اضغط لإرسال طلب للمدير</div></button>}</section>
      <section className="hud-card p-4 sm:p-5"><div className="flex items-center justify-between mb-3 gap-2"><div className="text-sm font-bold">حالة الجهاز والدوام</div><span className={`badge ${isWorkDay ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}><span className={`h-1.5 w-1.5 rounded-full ${isWorkDay ? "bg-primary" : "bg-accent"}`} />{isWorkDay ? "يوم عمل" : "يوم راحة"}</span></div><div className="grid grid-cols-2 gap-2 sm:gap-3 text-[11px] sm:text-xs"><Row label="نوع الدوام" value={emp.scheduleType === "ROTATION" ? "تناوبي" : "إداري ثابت"} /><Row label="حالة اليوم" value={scheduleStatus.label} /><Row label="الجهاز الموثّق" value={emp.deviceLabel ?? "لم يُربَط بعد"} /><Row label="فرع / موقع العمل" value={assignedLocation ? assignedLocation.name : "المقر الرئيسي"} /><Row label="بداية الدوام" value={emp.workStartTime || settings.workStart || "08:00"} /><Row label="نهاية الدوام" value={emp.workEndTime || settings.workEnd || "16:00"} /></div></section>
      {showRequestModal && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"><div className="hud-card w-full max-w-md p-6 space-y-4 relative bg-background"><h3 className="text-lg font-bold text-center">تقديم طلب إلى المدير</h3>{requestSent ? <div className="p-4 bg-primary/20 text-primary border border-primary/40 rounded-xl text-center font-bold">تم إرسال الطلب بنجاح وهو قيد انتظار موافقة المدير.</div> : <form onSubmit={handleSendRequest} className="space-y-4"><div><label className="text-xs text-muted-foreground block mb-1">نوع الطلب</label><select value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)} className="w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"><option value="permission">استئذان خروج مبكر</option><option value="leave">طلب إجازة</option><option value="checkout">انصراف بدون كود QR</option></select></div><div><label className="text-xs text-muted-foreground block mb-1">السبب (اختياري)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب سبب الطلب هنا..." className="w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm h-24 resize-none" /></div><div className="flex gap-2"><button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm">إرسال الطلب</button><button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2.5 btn-ghost rounded-xl text-sm">إلغاء</button></div></form>}</div></div>}
    </main>
  </div>);
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/40 border border-border/50 p-2 sm:p-3"><div className="text-[10px] text-muted-foreground mono">{label}</div><div className="font-extrabold mt-0.5 mono tabular-nums text-sm sm:text-lg">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/30 border border-border/50 p-2 sm:p-2.5"><div className="text-muted-foreground truncate">{label}</div><div className="font-semibold mt-0.5 truncate">{value}</div></div>; }
function ArrowIn() { return <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>; }
function ArrowOut() { return <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>; }
function RestIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>; }