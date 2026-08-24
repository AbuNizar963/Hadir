import { type ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bot, CloudSun, Compass, LayoutDashboard, Menu, UserRound, X, Clock3, CreditCard, Building2, LogOut } from "lucide-react";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { currentSession } from "@/lib/auth";
import { backendLogout } from "@/lib/backend";
import SessionWelcome from "@/components/SessionWelcome";

const NAV = [
  { to: "/employee", label: "لوحة الموظف", icon: LayoutDashboard, end: true },
  { to: "/employee/center", label: "مركز الموظف", icon: Building2 },
  { to: "/employee/premium", label: "البطاقة والخدمات", icon: CreditCard },
  { to: "/employee/history", label: "سجل العمل", icon: Clock3 },
  { to: "/employee/profile", label: "الملف الشخصي", icon: UserRound },
];

const utilityClass = "group flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/70 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary";

export default function EmployeeLayout({ title = "لوحة الموظف", subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = currentSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.classList.add("dark");
    }
  }, []);

  const logout = async () => {
    try {
      await backendLogout();
    } catch {
      // لا نمنع تسجيل الخروج المحلي إذا تعذر الاتصال بالخادم.
    }
    try {
      localStorage.removeItem("hadir.api.token.employee");
      localStorage.removeItem("hadir.employee.session");
      localStorage.removeItem("employeeAuth");
    } catch {
      // ignore storage errors
    }
    setMenuOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="sticky top-0 z-[60] border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-2 sm:px-4">
          <Link to="/employee" aria-label="حاضر" className="shrink-0"><Brand /></Link>

          <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="أدوات النظام">
            <button type="button" title="القائمة" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} className={cn(utilityClass, menuOpen && "border-primary/40 bg-primary/5 text-primary")}>
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              <span className="mt-0.5 text-[11px] font-semibold leading-none">القائمة</span>
            </button>
            <Link to="/weather" title="الطقس" aria-label="الطقس" className={utilityClass}><CloudSun className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">الطقس</span></Link>
            <Link to="/prayer" title="القبلة" aria-label="القبلة" className={utilityClass}><Compass className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">القبلة</span></Link>
            <Link to="/ai" title="المساعد" aria-label="المساعد" className={utilityClass}><Bot className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" /><span className="mt-0.5 text-[11px] font-semibold leading-none">المساعد</span></Link>
          </nav>
        </div>

        <div className="border-t border-border/60">
          <nav className="mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-2 py-1.5 sm:justify-center sm:px-4" aria-label="تنقل الموظف">
            {NAV.map(n => {
              const Icon = n.icon;
              return <NavLink key={n.to} to={n.to} end={n.end as any} aria-label={n.label} title={n.label} className={({ isActive }) => cn(
                "flex min-w-[86px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition",
                isActive ? "bg-primary/15 text-primary ring-1 ring-primary/35 shadow-sm" : "text-foreground/80 hover:bg-secondary hover:text-foreground"
              )}>
                <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                <span className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none">{n.label}</span>
              </NavLink>;
            })}
          </nav>
        </div>
      </div>

      {menuOpen && <div className="sticky top-[138px] z-50 border-b border-border/60 bg-card/98 shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2" dir="rtl">
          <Link to="/employee" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">لوحة الموظف</Link>
          <Link to="/employee/profile" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">الملف الشخصي</Link>
          <Link to="/employee/scan/attendance" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">تسجيل الحضور</Link>
          <Link to="/employee/scan/departure" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-secondary">تسجيل الانصراف</Link>
          <span className="rounded-lg px-3 py-2 text-xs text-muted-foreground">{session?.employeeId ? "حساب الموظف" : "الموظف"}</span>
          <button type="button" onClick={() => void logout()} className="rounded-lg px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10">
            <LogOut className="mr-1 inline h-4 w-4" aria-hidden="true" />
            تسجيل خروج
          </button>
        </div>
      </div>}

      <header className="mx-auto max-w-7xl border-b border-border/40 px-4 pb-5 pt-7 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground mono">HADIR · EMPLOYEE</div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</div>}
          </div>
          {actions}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-10">{children}</main>
      <SessionWelcome />
    </div>
  );
}
