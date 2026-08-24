import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CloudSun, Compass, LogOut, Menu, Paperclip, UserRound } from "lucide-react";
import { currentSession, logoutEmployee } from "@/lib/auth";

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "نهار سعيد";
  if (hour >= 17 && hour < 22) return "مساء الخير";
  return "ليل سعيد";
}

export default function ContextWidgets() {
  const location = useLocation();
  const nav = useNavigate();
  const session = currentSession();
  const sessionLoginAt = session?.loginAt;
  const [show, setShow] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const active = location.pathname.startsWith("/employee") || (location.pathname.startsWith("/manager") && !location.pathname.includes("/login"));
  const employee = location.pathname === "/employee" && Boolean(session);
  const message = useMemo(() => greeting(now.getHours()), [now]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active || !sessionLoginAt) return;
    const key = `hadir.welcome.${sessionLoginAt}`;
    if (sessionStorage.getItem(key)) return;
    setShow(true);
    sessionStorage.setItem(key, "1");
    const id = window.setTimeout(() => setShow(false), 7000);
    return () => window.clearTimeout(id);
  }, [active, sessionLoginAt]);

  useEffect(() => {
    document.body.dataset.hadirHome = employee ? "true" : "false";
    document.body.dataset.hadirScan = location.pathname.startsWith("/employee/scan/") ? "true" : "false";
    return () => {
      delete document.body.dataset.hadirHome;
      delete document.body.dataset.hadirScan;
    };
  }, [employee, location.pathname]);

  useEffect(() => {
    if (!employeeMenuOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-hadir-employee-menu]")) setEmployeeMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [employeeMenuOpen]);

  useEffect(() => {
    if (!employee) setEmployeeMenuOpen(false);
  }, [employee]);

  const employeeLogout = () => {
    setEmployeeMenuOpen(false);
    logoutEmployee();
    nav("/login", { replace: true });
  };

  return (
    <>
      <style>{`
        /* Employee menu is owned here on /employee only.
           Page-local copies are hidden so icons never stack. */
        body[data-hadir-home="true"] header.max-w-xl button[aria-label="فتح قائمة الموظف"],
        body[data-hadir-scan="true"] header.max-w-xl button[aria-label="فتح قائمة الموظف"] {
          display: none !important;
        }
      `}</style>

      {active && session && (
        <div className="fixed top-3 right-3 z-[80] w-[min(20rem,calc(100vw-1.5rem))] pointer-events-none">
          <div className={`hud-card p-3 shadow-xl transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}>
            <div className="text-xs text-muted-foreground">{message}</div>
            <div className="font-black mt-0.5 truncate">{session.name || "مرحبًا بك"} 👋</div>
            <div className="text-[10px] text-muted-foreground mt-1">نتمنى لك يومًا موفقًا</div>
          </div>
        </div>
      )}

      {employee && (
        <div data-hadir-employee-menu className="fixed left-3 top-3 z-[120]">
          <button type="button" onClick={() => setEmployeeMenuOpen(value => !value)} aria-label="فتح قائمة الموظف" aria-expanded={employeeMenuOpen} title="القائمة" className="grid h-12 w-12 place-items-center rounded-xl border border-border/70 bg-background/95 text-primary shadow-xl backdrop-blur hover:bg-secondary transition">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          {employeeMenuOpen && (
            <div className="absolute left-0 top-14 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-border/70 bg-background/98 p-2 shadow-2xl backdrop-blur" role="menu">
              <button type="button" onClick={() => { setEmployeeMenuOpen(false); nav("/employee/profile"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold hover:bg-secondary"><UserRound className="h-5 w-5 text-primary" /><span>الملف الشخصي</span></button>
              <div className="my-1 border-t border-border/60" /><div className="px-3 pb-1 pt-2 text-[10px] font-black text-muted-foreground">الملحقات</div>
              <button type="button" onClick={() => { setEmployeeMenuOpen(false); nav("/weather"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold hover:bg-secondary"><CloudSun className="h-5 w-5 text-sky-400" /><span>الطقس</span></button>
              <button type="button" onClick={() => { setEmployeeMenuOpen(false); nav("/prayer"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold hover:bg-secondary"><Compass className="h-5 w-5 text-emerald-400" /><span>مواقيت الصلاة والقبلة</span></button>
              <button type="button" onClick={() => { setEmployeeMenuOpen(false); nav("/ai"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold hover:bg-secondary"><span className="grid h-5 w-5 place-items-center text-violet-400 font-black">AI</span><span>المساعد الذكي</span></button>
              <button type="button" onClick={() => { setEmployeeMenuOpen(false); nav("/employee/history"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold hover:bg-secondary"><Paperclip className="h-5 w-5 text-amber-400" /><span>الملحقات وسجل العمل</span></button>
              <div className="my-1 border-t border-border/60" />
              <button type="button" onClick={employeeLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-destructive hover:bg-destructive/10"><LogOut className="h-5 w-5" /><span>تسجيل الخروج</span></button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
