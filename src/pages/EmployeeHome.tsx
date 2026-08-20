import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession, logoutEmployee } from "@/lib/auth";
import { backendLogout, getBackendEmployees, getBackendLocations, getBackendRequests, createBackendRequest } from "@/lib/backend";
import { getAttendance, getSettings, isShiftOver, type RequestType } from "@/lib/storage";
import { getEmployeeScheduleStatus } from "@/lib/schedule";
import { formatTime, formatDurationMinutes, todayKey, minutesBetween } from "@/lib/utils";

export default function EmployeeHome() {
  const nav = useNavigate();
  const session = currentSession();
  const [now, setNow] = useState(new Date());
  const [d1Employee, setD1Employee] = useState<any>(null);
  const [d1Locations, setD1Locations] = useState<any[]>([]);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (!session) nav("/login", { replace: true });
  }, [session, nav]);

  useEffect(() => {
    if (!session) return;
    let disposed = false;
    let refreshing = false;
    const refreshFromD1 = async () => {
      if (refreshing || disposed) return;
      refreshing = true;
      try {
        const [employees, locations] = await Promise.all([getBackendEmployees(), getBackendLocations()]);
        const remote = employees.find((employee) => employee.jobNumber === session.jobNumber || employee.id === session.employeeId) || null;
        if (disposed) return;
        setD1Employee(remote);
        setD1Locations(locations);
        setCloudReady(true);
        if (!remote || remote.status !== "active") {
          // D1 is authoritative: a deleted/deactivated employee must never remain logged in.
          backendLogout();
          logoutEmployee();
          nav("/login", { replace: true, state: { reason: "employee-removed" } });
        }
      } catch (error) {
        console.error("Employee D1 refresh failed", error);
      } finally {
        refreshing = false;
      }
    };
    void refreshFromD1();
    const interval = window.setInterval(() => void refreshFromD1(), 5000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshFromD1(); };
    const onFocus = () => void refreshFromD1();
    window.addEventListener("hadir:employees-changed", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("hadir:employees-changed", onFocus);
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
  // Never fall back to local employee data. The employee profile is exactly the D1 record.
  const emp = d1Employee;
  const settings = getSettings();
  if (!cloudReady || !emp) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">جاري تحميل بيانات الموظف من D1...</div>;

  const assignedLocation = useMemo(() => emp.locationId ? d1Locations.find((loc) => loc.id === emp.locationId) : null, [emp, d1Locations]);
  const scheduleStatus = useMemo(() => getEmployeeScheduleStatus(emp, now), [emp, now]);
  const isWorkDay = scheduleStatus.isWorkDay;
  const todays = useMemo(() => getAttendance().filter((r) => r.employeeId === emp.id && r.timestamp.startsWith(todayKey())), [emp.id, now]);
  const checkIn = todays.find((r) => r.type === "check-in" || r.type === "in");
  const checkOut = todays.find((r) => r.type === "check-out" || r.type === "out");
  const workedMinutes = checkIn ? minutesBetween(checkIn.timestamp, checkOut?.timestamp ?? new Date().toISOString()) : 0;
  const workStartTime = emp.workStartTime || "08:00";
  const [hh, mm] = workStartTime.split(":").map(Number);
  let lateMinutes = 0;
  if (checkIn) {
    const scheduled = new Date(checkIn.timestamp);
    scheduled.setHours(hh, mm, 0, 0);
    const diff = Math.round((new Date(checkIn.timestamp).getTime() - scheduled.getTime()) / 60000);
    lateMinutes = Math.max(0, diff - (emp.gracePeriodMinutes ?? 10));
  }
  const shiftEnded = isShiftOver(emp);
  const logout = () => { backendLogout(); logoutEmployee(); nav("/login"); };
  const canCheckIn = isWorkDay && !checkIn;
  const canCheckOut = isWorkDay && !!checkIn && !checkOut && shiftEnded;

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    void createBackendRequest({ employeeId: emp.id, employeeName: emp.name, jobNumber: emp.jobNumber, type: requestType, reason })
      .then(() => setRequestSent(true)).catch((error) => { console.error(error); setRequestSent(false); });
    setRequestSent(true);
    setTimeout(() => { setRequestSent(false); setShowRequestModal(false); setReason(""); }, 2000);
  };

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-between"><Brand /><button onClick={logout} className="btn-ghost text-xs">خروج</button></header>
      <main className="max-w-xl mx-auto px-4 sm:px-5 pb-16 space-y-4 sm:space-y-5">
        <section className="hud-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {emp.avatar ? <img src={emp.avatar} alt={emp.name} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border-2 border-primary/40 shrink-0" /> : <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/15 grid place-items-center border-2 border-primary/30 shrink-0"><span className="text-primary font-extrabold text-lg sm:text-xl">{emp.name?.charAt(0) || "م"}</span></div>}
              <div className="min-w-0"><div className="text-[10px] text-muted-foreground mono">EMPLOYEE</div><div className="text-base sm:text-xl font-extrabold mt-0.5 truncate">{emp.name}</div><div className="text-[11px] sm:text-xs text-muted-foreground mono mt-0.5">رقم وظيفي: {emp.jobNumber}</div></div>
            </div>
            <div className="text-left shrink-0"><div className="mono text-xl sm:text-3xl font-extrabold tabular-nums">{now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false })}</div><div className="text-[10px] sm:text-xs text-muted-foreground mono">{now.toLocaleDateString("ar-EG", { weekday: "long", day: "2-digit", month: "2-digit" })}</div></div>
          </div>
          <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 text-center"><Stat label="الحضور" value={checkIn ? formatTime(checkIn.timestamp) : "—"} /><Stat label="الانصراف" value={checkOut ? formatTime(checkOut.timestamp) : "—"} /><Stat label="ساعات العمل" value={formatDurationMinutes(workedMinutes)} /></div>
          {!isWorkDay && <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs sm:text-sm text-accent font-semibold">{scheduleStatus.label} — استمتع بيومك بلا التزامات دوام.</div>}
          {isWorkDay && lateMinutes > 0 && <div className="mt-4 rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3 text-xs text-[hsl(var(--warning))] font-semibold">تم رصد تأخر {lateMinutes} دقيقة عن بداية الدوام ({workStartTime}).</div>}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-muted/40 p-2">نظام الدوام: <b>{emp.scheduleType === "ROTATION" ? "تناوبي" : "إداري"}</b></div><div className="rounded-lg bg-muted/40 p-2">الدوام: <b>{emp.workStartTime || "—"} → {emp.workEndTime || "—"}</b></div><div className="rounded-lg bg-muted/40 p-2">المقر: <b>{assignedLocation?.name || "—"}</b></div><div className="rounded-lg bg-muted/40 p-2">الجهاز: <b>{emp.deviceLabel || (emp.deviceId ? "مربوط" : "غير مربوط")}</b></div></div>
        </section>
        <section className="grid grid-cols-2 gap-3">
          <Link to="/employee/scan/check-in" aria-disabled={!canCheckIn} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckIn ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/15 grid place-items-center mb-2 signal-ring"><ArrowIn /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل حضور</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{!isWorkDay ? "أنت في يوم راحة (Off)" : checkIn ? "تم بالفعل اليوم" : "امسح رمز QR داخل المقر"}</div></Link>
          <Link to="/employee/scan/check-out" aria-disabled={!canCheckOut} className={`hud-card p-4 sm:p-5 text-center transition ${!canCheckOut ? "opacity-40 pointer-events-none" : "hover:brightness-110"}`}><div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-accent/15 grid place-items-center mb-2"><ArrowOut /></div><div className="font-extrabold text-sm sm:text-lg">تسجيل انصراف</div><div className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{!isWorkDay ? "يوم راحة" : !checkIn ? "سجّل الحضور أولًا" : checkOut ? "تم بالفعل اليوم" : shiftEnded ? "متاح الآن" : "ينفتح عند نهاية الدوام"}</div></Link>
        </section>
        <section className="hud-card p-5"><div className="flex items-center justify-between"><div><div className="font-extrabold">طلب إداري</div><div className="text-xs text-muted-foreground mt-1">إرسال طلب محفوظ مباشرة في D1</div></div><button className="btn-primary" onClick={() => setShowRequestModal(true)}>طلب جديد</button></div></section>
      </main>
      {showRequestModal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><form onSubmit={handleSendRequest} className="hud-card w-full max-w-md p-5 space-y-4"><h2 className="font-extrabold">طلب إداري</h2><select className="input w-full" value={requestType} onChange={e => setRequestType(e.target.value as RequestType)}><option value="permission">إذن</option><option value="leave">إجازة</option><option value="attendance">تصحيح حضور</option><option value="other">أخرى</option></select><textarea className="input w-full min-h-28" value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الطلب" required /><div className="flex gap-2 justify-end"><button type="button" className="btn-ghost" onClick={() => setShowRequestModal(false)}>إلغاء</button><button className="btn-primary" type="submit">إرسال</button></div>{requestSent && <div className="text-sm text-accent">تم إرسال الطلب.</div>}</form></div>}
    </div>
  );
}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-muted/30 p-2 sm:p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mono font-bold text-sm sm:text-base mt-0.5">{value}</div></div>}
function ArrowIn(){return <span className="text-primary text-xl">↘</span>}
function ArrowOut(){return <span className="text-accent text-xl">↗</span>}
