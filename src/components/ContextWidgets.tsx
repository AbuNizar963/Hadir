import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { currentSession } from "@/lib/auth";

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "نهار سعيد";
  if (hour >= 17 && hour < 22) return "مساء الخير";
  return "ليل سعيد";
}

/** Global contextual layer only. Navigation belongs to the page/layout that owns it. */
export default function ContextWidgets() {
  const location = useLocation();
  const session = currentSession();
  const sessionLoginAt = session?.loginAt;
  const [show, setShow] = useState(false);
  const [now, setNow] = useState(new Date());
  const active = location.pathname.startsWith("/employee") || (location.pathname.startsWith("/manager") && !location.pathname.includes("/login"));

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
    document.body.dataset.hadirHome = location.pathname === "/employee" ? "true" : "false";
    document.body.dataset.hadirScan = location.pathname.startsWith("/employee/scan/") ? "true" : "false";
    return () => {
      delete document.body.dataset.hadirHome;
      delete document.body.dataset.hadirScan;
    };
  }, [location.pathname]);

  if (!active || !session) return null;

  return (
    <div className="fixed top-3 right-3 z-[80] w-[min(20rem,calc(100vw-1.5rem))] pointer-events-none" aria-live="polite">
      <div className={`hud-card p-3 shadow-xl transition-all duration-300 ${show ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}>
        <div className="text-xs text-muted-foreground">{message}</div>
        <div className="font-black mt-0.5 truncate">{session.name || "مرحبًا بك"} 👋</div>
        <div className="text-[10px] text-muted-foreground mt-1">نتمنى لك يومًا موفقًا</div>
      </div>
    </div>
  );
}
