import { Link } from "react-router-dom";
import Brand from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-5">
        <Brand />
      </header>
      <main className="flex-1 grid place-items-center px-5">
        <div className="hud-card p-8 text-center max-w-md">
          <div className="mono text-xs text-muted-foreground">ERROR · 404</div>
          <h1 className="text-3xl font-extrabold mt-2">الصفحة غير موجودة</h1>
          <p className="text-sm text-muted-foreground mt-2">
            الرابط الذي حاولت الوصول إليه غير متاح.
          </p>
          <Link to="/" className="btn-primary mt-5 inline-flex">
            العودة للرئيسية
          </Link>
        </div>
      </main>
    </div>
  );
}
