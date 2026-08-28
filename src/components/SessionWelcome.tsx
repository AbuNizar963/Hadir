import { useEffect, useMemo, useState } from "react";
import { currentSession } from "@/lib/auth";
import { getManagerSession } from "@/lib/storage";

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "صباح الخير";
  if (hour >= 12 && hour < 17) return "نهار سعيد";
  if (hour >= 17 && hour < 22) return "مساء الخير";
  return "ليل سعيد";
}

type WelcomeSession = {
  name?: string | null;
  loginAt?: string | null;
};

export default function SessionWelcome() {
  const employeeSession = currentSession();
  const managerSession = getManagerSession();
  const session: WelcomeSession | null = employeeSession || managerSession || null;
  const sessionLoginAt = session?.loginAt || null;
  const [show, setShow] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const message = useMemo(() => greeting(now.getHours()), [now]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sessionLoginAt) return;

    const key = `hadir.welcome.${sessionLoginAt}`;
    if (sessionStorage.getItem(key)) return;

    setShow(true);
    sessionStorage.setItem(key, "1");

    const id = window.setTimeout(() => setShow(false), 3000);
    return () => window.clearTimeout(id);
  }, [sessionLoginAt]);

  if (!session) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[2px] transition-opacity duration-300 ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      dir="rtl"
      aria-live="polite"
      aria-hidden={!show}
    >
      <div
        className={`w-full max-w-md transform rounded-3xl border-2 border-emerald-500/70 bg-card p-7 text-center shadow-2xl shadow-emerald-500/10 transition-all duration-300 sm:p-8 ${
          show ? "translate-y-0 scale-100" : "translate-y-3 scale-95"
        }`}
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-3xl text-emerald-600 dark:text-emerald-400">
          ✓
        </div>

        <div className="mt-5 text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
          HADIR · LOGIN SUCCESS
        </div>

        <div className="mt-2 text-xl font-black text-foreground sm:text-2xl">
          {message}
        </div>

        <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 sm:text-3xl">
          {session.name || "مرحبًا بك"} 👋
        </div>

        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          تم تسجيل دخولك بنجاح، نتمنى لك يوم عمل موفقًا.
        </p>
      </div>
    </div>
  );
}
