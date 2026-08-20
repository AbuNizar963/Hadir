import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession, logoutEmployee } from "@/lib/auth";
import {
  getAttendance,
  getSettings,
  findEmployeeByJobNumber,
  isShiftOver,
  addRequest,
  type RequestType,
} from "@/lib/storage";
import { backendLogout, getBackendEmployeeProfile, getBackendLocations, getBackendRequests, createBackendRequest } from "@/lib/backend";
import { getEmployeeScheduleStatus } from "@/lib/schedule";
import { formatTime, formatDurationMinutes, todayKey, minutesBetween } from "@/lib/utils";

export default function EmployeeHome() {
  const nav = useNavigate();
  const session = currentSession();
  const [now, setNow] = useState(new Date());
  const [, setCloudVersion] = useState(0);
  const [d1Employee, setD1Employee] = useState<typeof findEmployeeByJobNumber extends never ? never : any>(null);
  const [d1Locations, setD1Locations] = useState<any[]>([]);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (!session) nav("/login", { replace: true });
  }, [session, nav]);

  useEffect(() => {
    if (!session) return;
    let disposed = false;
    let refreshing = false;
    const refreshFromCloud = async () => {
      if (refreshing || disposed) return;
      refreshing = true;
      try {
        const [remote, remoteLocations] = await Promise.all([getBackendEmployeeProfile(), getBackendLocations()]);
        if (disposed) return;
        setD1Employee(remote);
        setD1Locations(remoteLocations);
        setCloudReady(true);
        setCloudVersion((v) => v + 1);
        // D1 is authoritative. A deleted or deactivated employee must be logged out immediately.
        if (!remote || remote.status !== "active") {
          backendLogout();
          logoutEmployee();
          nav("/login", { replace: true, state: { reason: "employee-removed" } });
        }
      } catch (error) {
        console.error("Employee D1 refresh failed", error); setCloudReady(false);
      } finally {
        refreshing = false;
      }
    };
    void refreshFromCloud();
    const interval = window.setInterval(() => void refreshFromCloud(), 5000);
    const onEmployeesChanged = () => void refreshFromCloud();
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshFromCloud(); };
    const onFocus = () => void refreshFromCloud();
    window.addEventListener("hadir:employees-changed", onEmployeesChanged);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("hadir:employees-changed", onEmployeesChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [session?.employeeId, session?.jobNumber, nav]);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("permission");
  const [reason, setReason] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!session) return null;

  // Never use a local employee record as a fallback. The employee profile is the exact D1 record.
  const emp = d1Employee;
  const settings = getSettings();
  if (!cloudReady || !emp) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">جاري تحميل بيانات الموظف من D1...</div>;
  }

  const assignedLocation = useMemo(() => {
    if (emp?.locationId) return d1Locations.find((loc) => loc.id === emp.locationId) || null;
    return null;
  }, [emp, d1Locations]);

  const scheduleStatus = useMemo(() => getEmployeeScheduleStatus(emp, now), [emp, now]);
  const isWorkDay = scheduleStatus.isWorkDay;

  const todays = useMemo(
    () => getAttendance().filter((r) => r.employeeId === emp.id && r.timestamp.startsWith(todayKey())),
    [emp.id, now]
  );
  const checkIn = todays.find((r) => r.type === "check-in" || r.type === "in");
  const checkOut = todays.find((r) => r.type === "check-out" || r.type === "out");
  const workedMinutes = checkIn ? minutesBetween(checkIn.timestamp, checkOut?.timestamp ?? new Date().toISOString()) : 0;

  const workStartTime = emp?.workStartTime || settings.workStart || "08:00";
  const [hh, mm] = workStartTime.split(":").map(Number);
  let lateMinutes = 0;
  if (checkIn) {
    const scheduled = new Date(checkIn.timestamp);
    scheduled.setHours(hh, mm, 0, 0);
    const diff = Math.round((new Date(checkIn.timestamp).getTime() - scheduled.getTime()) / 60000);
    const grace = emp?.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    lateMinutes = Math.max(0, diff - grace);
  }

  const shiftEnded = isShiftOver(emp);
  const logout = () => { backendLogout(); logoutEmployee(); nav("/login"); };
  const canCheckIn = isWorkDay && !checkIn;
  const canCheckOut = isWorkDay && !!checkIn && !checkOut && shiftEnded;

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emp) return;
    void createBackendRequest({ employeeId: emp.id, employeeName: emp.name, jobNumber: emp.jobNumber, type: requestType, reason })
      .then(() => setRequestSent(true)).catch((error) => { console.error(error); setRequestSent(false); });
    setRequestSent(true);
    setTimeout(() => { setRequestSent(false); setShowRequestModal(false); setReason(""); }, 2000);
  };

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-between">
        <Brand /><button onClick={logout} className="btn-ghost text-xs">خروج</button>
      </header>
      <main className="max-w-xl mx-auto px-4 sm:px-5 pb-16 space-y-4 sm:space-y-5">
        <section className="hud-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {emp?.avatar ? <img src={emp.avatar} alt={emp.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-2 border-primary/40 shrink-0" /> : <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/15 grid place-items-center border-2 border-primary/30 shrink-0"><span className="text-primary font-extrabold text-lg sm:text-xl">{emp.name ? emp.name.charAt(0) : "م"}</span></div>}
              <div className="min-w-0"><div className="text-[10px] text-muted-foreground mono">EMPLOYEE</div><div className="text-base sm:text-xl font-extrabold mt-0.5 truncate">{emp.name}</div><div className="text-[11px] sm:text-xs text-muted-foreground mono mt-0.5">رقم وظيفي: {emp.jobNumber}</div></div>
            </div>
            <div className="text-left shrink-0"><div className="mono text-xl sm:text-3xl font-extrabold tabular-nums">{now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })}</div><div className="text-[10px] sm:text-xs text-muted-foreground mono">{now.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "2-digit" })}</div></div>
          </div>
          <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 text-center"><Stat label="الحضور" value={checkIn ? formatTime(checkIn.timestamp) : "—"} /><Stat label="الانصراف" value={checkOut ? formatTime(checkOut.timestamp) : "—"} /><Stat label="ساعات العمل" value={formatDurationMinutes(workedMinutes)} /></div>
          {!isWorkDay && <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs sm:text-sm text-accent font-semibold flex items-center gap-2"><RestIcon /><span>{scheduleStatus.label} — استمتع بيومك بلا التزامات دوام.</span></div>}
          {isWorkDay && lateMinutes > 0 && <div className="mt-4 rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3 text-xs text-[hsl(var(--warning))] font-semibold">تم رصد تأخر {lateMinutes} دقيقة عن بداية الدوام ({workStartTime}).</div>}
        </section>
        <section className="grid grid-cols-2 gap-3">
          <Link to="/employee/scan/check-in" aria-disabled={!canCheckIn} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckIn ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/15 grid place-items-center mb-2 signal-ring"><ArrowIn /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل حضور</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{!isWorkDay ? "أنت في يوم راحة (Off)" : checkIn ? "تم بالفعل اليوم" : "امسح رمز QR داخل المقر"}</div></Link>
          {shiftEnded ? <Link to="/employee/scan/check-out" aria-disabled={!canCheckOut} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckOut ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-accent/15 grid place-items-center mb-2"><ArrowOut /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل انصراف</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{checkOut ? "تم بالفعل اليوم" : "انتهى الدوام، امسح QR للانصراف"}</div></Link> : <button onClick={() => setShowRequestModal(true)} className="hud-card p-4 sm:p-5 text-center transition hover:brightness-110 border-dashed border-accent/40"><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-accent/10 grid place-items-center mb-2"><ArrowOut /></div><div className="font-extrabold text-sm sm:text-lg text-accent">طلب استئذان / إجازة</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">الدوام لم ينتهِ بعد، اضغط لإرسال طلب للمدير</div></button>}
        </section>
        <section className="hud-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-2"><div className="text-sm font-bold">حالة الجهاز والدوام</div><span className={`badge ${isWorkDay ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}><span className={`h-1.5 w-1.5 rounded-full ${isWorkDay ? "bg-primary" : "bg-accent"}`} />{isWorkDay ? "يوم عمل" : "يوم راحة"}</span></div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-[11px] sm:text-xs"><Row label="نوع الدوام" value={emp?.scheduleType === "ROTATION" ? "تناوبي" : "إداري ثابت"} /><Row label="حالة اليوم" value={scheduleStatus.label} /><Row label="الجهاز الموثّق" value={emp?.deviceLabel ?? "لم يُربَط بعد"} /><Row label="فرع / موقع العمل" value={assignedLocation ? assignedLocation.name : "المقر الرئيسي"} /><Row label="بداية الدوام" value={emp?.workStartTime || settings.workStart || "08:00"} /><Row label="نهاية الدوام" value={emp?.workEndTime || settings.workEnd || "16:00"} /></div>
          {emp.scheduleType === "ROTATION" && <div className="mt-3 grid grid-cols-2 gap-2"><Row label="أيام العمل" value={String(emp.rotationDaysOn ?? "—")} /><Row label="أيام الراحة" value={String(emp.rotationDaysOff ?? "—")} /></div>}
          <div className="mt-3 text-[10px] text-muted-foreground text-center">آخر مزامنة: {now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</div>
        </section>
        {showRequestModal && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"><div className="hud-card w-full max-w-md p-6 space-y-4 relative bg-background"><h3 className="text-lg font-bold text-center">تقديم طلب إلى المدير</h3>{requestSent ? <div className="p-4 bg-primary/20 text-primary border border-primary/40 rounded-xl text-center font-bold">تم إرسال الطلب بنجاح وهو قيد انتظار موافقة المدير.</div> : <form onSubmit={handleSendRequest} className="space-y-4"><div><label className="text-xs text-muted-foreground block mb-1">نوع الطلب</label><select value={requestType} onChange={(e) => setRequestType(e.target.value as RequestType)} className="w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm"><option value="permission">استئذان خروج مبكر</option><option value="leave">طلب إجازة</option><option value="checkout">انصراف بدون كود QR</option></select></div><div><label className="text-xs text-muted-foreground block mb-1">السبب (اختياري)</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب سبب الطلب هنا..." className="w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-sm h-24 resize-none" /></div><div className="flex gap-2"><button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm">إرسال الطلب</button><button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2.5 btn-ghost rounded-xl text-sm">إلغاء</button></div></form>}</div></div>}
      </main>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/40 border border-border/50 p-2 sm:p-3"><div className="text-[10px] text-muted-foreground mono">{label}</div><div className="font-extrabold mt-0.5 mono tabular-nums text-sm sm:text-lg">{value}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/30 border border-border/50 p-2 sm:p-2.5"><div className="text-muted-foreground truncate">{label}</div><div className="font-semibold mt-0.5 truncate">{value}</div></div>; }
function ArrowIn() { return <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>; }
function ArrowOut() { return <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>; }
function RestIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>; }
