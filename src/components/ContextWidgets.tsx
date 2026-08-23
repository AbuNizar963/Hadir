import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, CloudSun, Compass } from "lucide-react";
import { currentSession } from "@/lib/auth";
import { getManagerSession } from "@/lib/storage";

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
  const managerSession = getManagerSession();
  const [show, setShow] = useState(false);
  const [now, setNow] = useState(new Date());
  const active = location.pathname.startsWith("/employee") || (location.pathname.startsWith("/manager") && !location.pathname.includes("/login"));
  const manager = location.pathname.startsWith("/manager") && !location.pathname.includes("/login") && Boolean(managerSession);
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

  return (
    <>
      {active && session && (
        <div className="fixed top-3 right-3 z-[80] w-[min(20rem,calc(100vw-1.5rem))] pointer-events-none">
          <div className={`hud-card p-3 shadow-xl transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}>
            <div className="text-xs text-muted-foreground">{message}</div>
            <div className="font-black mt-0.5 truncate">{session.name || "مرحبًا بك"} 👋</div>
            <div className="text-[10px] text-muted-foreground mt-1">نتمنى لك يومًا موفقًا</div>
          </div>
        </div>
      )}
      {manager && (
        <div className="fixed z-[90] top-3 left-3 lg:left-auto lg:right-[17rem] flex items-center gap-2">
          <button type="button" onClick={() => nav("/ai")} aria-label="فتح المساعد الذكي" title="المساعد الذكي" className="relative h-11 w-11 rounded-xl bg-primary/10 border border-primary/30 text-primary shadow-lg grid place-items-center hover:bg-primary/15 hover:-translate-y-0.5 transition-all">
            <Bot className="h-5 w-5" aria-hidden="true" />
            <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </button>
          <button type="button" onClick={() => nav("/weather")} aria-label="فتح الطقس" title="الطقس" className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-400/25 text-sky-300 shadow-lg grid place-items-center hover:bg-sky-500/15 hover:-translate-y-0.5 transition-all">
            <CloudSun className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nav("/prayer")} aria-label="فتح مواقيت الصلاة واتجاه القبلة" title="الصلاة والقبلة" className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 shadow-lg grid place-items-center hover:bg-emerald-500/15 hover:-translate-y-0.5 transition-all">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
