import { useNavigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import WeatherCard from "@/components/WeatherCard";

export default function WeatherPage() {
  const navigate = useNavigate();
  const session = currentSession();
  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-6" dir="rtl">
      <div className="mx-auto w-full max-w-5xl">
        <button type="button" onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-2 text-sm font-bold hover:bg-secondary transition-colors">
          <span aria-hidden="true">→</span> العودة
        </button>
        <section className="hud-card overflow-hidden p-5 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">الطقس المباشر</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black">الطقس الآن 🌤️</h1>
              <p className="mt-1 text-sm text-muted-foreground">بيانات محدثة تلقائيًا من موقعك الحالي.</p>
            </div>
            {session?.name && <div className="text-sm font-bold">مرحبًا {session.name} 👋</div>}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <WeatherCard title="موقعك الحالي" className="min-h-[180px]" />
            <WeatherCard title="موقع العمل" className="min-h-[180px]" />
          </div>
          <div className="mt-5 rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
            يتحدث الطقس تلقائيًا كل 10 دقائق دون إعادة تحميل الواجهة.
          </div>
        </section>
      </div>
    </main>
  );
}
