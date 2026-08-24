import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, CloudSun, Compass, Menu, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import NotificationBell from "@/components/NotificationBell";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/employee";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-[60] border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5" dir="rtl">
          <Link to="/employee" aria-label="حاضر" className="shrink-0">
            <Brand />
          </Link>
          <nav className="flex min-w-0 items-center gap-1.5" aria-label="تنقل الموظف">
            <Link to="/weather" title="الطقس" aria-label="الطقس" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition">
              <CloudSun className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link to="/prayer" title="القبلة" aria-label="القبلة" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </Link>
            <NotificationBell />
            <Link to="/employee/profile" title="الملف الشخصي" aria-label="الملف الشخصي" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Link>
            <button type="button" title="القائمة" aria-label="القائمة" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5">{children}</main>
    </div>
  );
}
