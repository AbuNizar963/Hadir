import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { CloudSun, Compass, Menu, UserRound, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import NotificationBell from "@/components/NotificationBell";
import { currentSession } from "@/lib/auth";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const session = currentSession();
  const userId = session?.employeeId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-[60] border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5" dir="rtl">
          <Link to="/employee" aria-label="حاضر" className="shrink-0"><Brand /></Link>
          <nav className="flex min-w-0 items-center gap-1.5" aria-label="تنقل الموظف" dir="ltr">
            <Link to="/weather" title="الطقس" aria-label="الطقس" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition"><CloudSun className="h-5 w-5" aria-hidden="true" /></Link>
            <Link to="/prayer" title="القبلة" aria-label="القبلة" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition"><Compass className="h-5 w-5" aria-hidden="true" /></Link>
            {userId ? <NotificationBell userId={userId} /> : null}
            <Link to="/employee/profile" title="الملف الشخصي" aria-label="الملف الشخصي" className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition"><UserRound className="h-5 w-5" aria-hidden="true" /></Link>
            <button type="button" title="القائمة" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-border/60 bg-background hover:bg-secondary transition">{menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}</button>
          </nav>
        </div>
        {menuOpen && (
          <div className="border-t border-border/60 bg-background/98 shadow-lg">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-3 py-2 sm:px-5" dir="rtl">
              <Link onClick={() => setMenuOpen(false)} to="/employee/center" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-secondary">مركز الموظف</Link>
              <Link onClick={() => setMenuOpen(false)} to="/employee/premium" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-secondary">البطاقة والخدمات</Link>
              <Link onClick={() => setMenuOpen(false)} to="/employee/history" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-secondary">سجل العمل</Link>
              <Link onClick={() => setMenuOpen(false)} to="/ai" className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-secondary">المساعد الذكي</Link>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5">{children}</main>
    </div>
  );
}
