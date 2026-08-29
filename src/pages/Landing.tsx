import { Link } from "react-router-dom";
import Brand from "@/components/Brand";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-5 py-6 flex items-center justify-between">
        <Brand />
        <div className="text-xs text-muted-foreground mono hidden sm:block">
          نظام آمن · مبني على التحقق متعدد الطبقات
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pb-16">
        <section className="grid lg:grid-cols-5 gap-6 items-stretch">
          <div className="hud-card p-8 lg:col-span-3 flex flex-col justify-between">
            <div>
              <div className="badge bg-primary/15 text-primary mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                جاهز للاستخدام
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
                حضور وانصراف موثّق
                <br />
                <span className="text-primary">من الجهاز الصحيح، وفي المكان الصحيح.</span>
              </h1>
              <p className="mt-4 text-muted-foreground text-base leading-7 max-w-xl">
                نظام إلكتروني يمنع الغش عبر ربط كل حساب بجهاز واحد، والتحقق من
                الموقع الجغرافي داخل نطاق مقر العمل، مع رمز QR ثابت وسجل تدقيق
                غير قابل للتعديل.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary">
                دخول الموظفين
                <Arrow />
              </Link>
              <Link to="/manager/login" className="btn-secondary">
                لوحة المدير
              </Link>
            </div>
          </div>

          <div className="hud-card p-6 lg:col-span-2 flex flex-col gap-4">
            <div className="text-xs text-muted-foreground mono">STATUS · طبقات التحقق</div>
            <Layer index="01" title="ربط الحساب بالجهاز" desc="لا يمكن تسجيل حضور موظف من هاتف زميله." />
            <Layer index="02" title="التحقق من الموقع (GPS)" desc="داخل النطاق المسموح حول مقر العمل فقط." />
            <Layer index="03" title="رمز QR ثابت داخل الموقع" desc="لا يعمل QR وحده — يُستخدم مع باقي الطبقات." />
            <Layer index="04" title="سجل تدقيق دائم" desc="كل عملية ناجحة أو مرفوضة تُسجَّل." />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-6">
          <Metric label="سرعة العملية" value="< 5 ث" hint="من فتح الرابط حتى تأكيد الحضور" />
          <Metric label="دقة الموقع" value="~10 م" hint="عبر GPS عالي الدقة في المتصفح" />
          <Metric label="طبقات الحماية" value="4" hint="جهاز · موقع · QR · سجل" />
        </section>

        <section className="hud-card mt-6 p-6">
          <div className="text-xs text-muted-foreground mono mb-3">FLOW · تسلسل التحقق</div>
          <ol className="grid md:grid-cols-6 gap-3 text-sm">
            {[
              "تسجيل الدخول",
              "التحقق من الجهاز",
              "الحصول على GPS",
              "التأكد من النطاق",
              "مسح QR الثابت",
              "تسجيل العملية",
            ].map((t, i) => (
              <li key={t} className="rounded-xl border border-border/60 p-3 bg-secondary/30">
                <div className="mono text-[10px] text-primary">STEP {String(i + 1).padStart(2, "0")}</div>
                <div className="font-semibold mt-1">{t}</div>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-muted-foreground text-center mt-8 leading-6">
          Developed by AbuNizar963
        </p>
      </main>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function Layer({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3">
      <div className="mono text-xs text-primary shrink-0 pt-0.5">{index}</div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="hud-card p-5">
      <div className="text-xs text-muted-foreground mono">{label}</div>
      <div className="text-3xl font-extrabold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}
