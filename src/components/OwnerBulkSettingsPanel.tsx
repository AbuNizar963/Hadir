import { useState } from "react";
import { currentManager } from "@/lib/auth";
import { bulkOwnerEmployeeSettings } from "@/lib/ownerBulkSettings";

export default function OwnerBulkSettingsPanel() {
  const manager = currentManager();
  const isOwner = manager?.role === "owner" || manager?.accountId === "bootstrap";
  const [password, setPassword] = useState("");
  const [grace, setGrace] = useState("10");
  const [earlyCheckout, setEarlyCheckout] = useState("0");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  if (!isOwner) return null;

  const run = async (action: "password" | "grace" | "earlyCheckout" | "avatar") => {
    setMessage("");
    try {
      setBusy(action);
      if (action === "password") {
        if (password.length < 6) throw new Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
        const result = await bulkOwnerEmployeeSettings({ action, password });
        setMessage(`تم تغيير كلمة مرور ${result.updated} موظفًا بنجاح.`);
        setPassword("");
      } else if (action === "grace") {
        const minutes = Number(grace);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) throw new Error("مهلة التأخر يجب أن تكون بين 0 و180 دقيقة.");
        const result = await bulkOwnerEmployeeSettings({ action, minutes });
        setMessage(`تم ضبط مهلة التأخر لـ ${result.updated} موظفًا إلى ${minutes} دقيقة.`);
      } else if (action === "earlyCheckout") {
        const minutes = Number(earlyCheckout);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) throw new Error("مهلة الانصراف المبكر يجب أن تكون بين 0 و180 دقيقة.");
        const result = await bulkOwnerEmployeeSettings({ action, minutes });
        setMessage(`تم ضبط مهلة الانصراف المبكر العامة إلى ${minutes} دقيقة.`);
      } else {
        if (!image) throw new Error("اختر صورة أولًا.");
        if (!image.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة.");
        if (image.size > 10 * 1024 * 1024) throw new Error("حجم الصورة الأصلية يجب ألا يتجاوز 10 ميغابايت.");
        const result = await bulkOwnerEmployeeSettings({ action, file: image });
        setMessage(`تم تحديث صورة ${result.updated} موظفًا بنجاح.`);
        setImage(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy(null);
    }
  };

  return <section className="hud-card p-5 sm:p-6 border-primary/30 bg-primary/5">
    <div className="text-xs mono text-primary font-bold mb-1">OWNER CONTROL · BULK EMPLOYEE SETTINGS</div>
    <h2 className="text-lg font-bold mb-1">إدارة الموظفين دفعة واحدة</h2>
    <p className="text-sm text-muted-foreground mb-5">أدوات مالك النظام لتطبيق الإعداد نفسه على جميع الموظفين دون فتح ملفاتهم واحدًا واحدًا.</p>
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl border bg-background/60 p-4">
        <div className="font-bold mb-1">🔐 تغيير كلمة السر</div>
        <p className="text-xs text-muted-foreground mb-3">تُطبّق على جميع الموظفين.</p>
        <div className="flex gap-2">
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة مرور جديدة" />
          <button type="button" className="btn-primary whitespace-nowrap" disabled={!!busy} onClick={() => void run("password")}>{busy === "password" ? "جارٍ…" : "تطبيق"}</button>
        </div>
      </div>
      <div className="rounded-2xl border bg-background/60 p-4">
        <div className="font-bold mb-1">🖼️ تغيير الصورة الشخصية</div>
        <p className="text-xs text-muted-foreground mb-3">الصورة نفسها تُحفظ في R2 لكل موظف.</p>
        <div className="flex gap-2 items-center">
          <input type="file" accept="image/*" className="input text-xs" onChange={e => setImage(e.target.files?.[0] || null)} />
          <button type="button" className="btn-primary whitespace-nowrap" disabled={!!busy || !image} onClick={() => void run("avatar")}>{busy === "avatar" ? "جارٍ…" : "تطبيق"}</button>
        </div>
      </div>
      <div className="rounded-2xl border bg-background/60 p-4">
        <div className="font-bold mb-1">⏱️ مهلة التأخر</div>
        <p className="text-xs text-muted-foreground mb-3">تحديث مهلة السماح قبل احتساب التأخر لجميع الموظفين.</p>
        <div className="flex gap-2">
          <input type="number" min="0" max="180" className="input mono" value={grace} onChange={e => setGrace(e.target.value)} />
          <span className="self-center text-xs text-muted-foreground">دقيقة</span>
          <button type="button" className="btn-primary whitespace-nowrap" disabled={!!busy} onClick={() => void run("grace")}>{busy === "grace" ? "جارٍ…" : "تطبيق"}</button>
        </div>
      </div>
      <div className="rounded-2xl border bg-background/60 p-4">
        <div className="font-bold mb-1">🚪 مهلة الانصراف المبكر</div>
        <p className="text-xs text-muted-foreground mb-3">السماح بتسجيل الانصراف قبل نهاية الدوام ضمن المهلة المحددة.</p>
        <div className="flex gap-2">
          <input type="number" min="0" max="180" className="input mono" value={earlyCheckout} onChange={e => setEarlyCheckout(e.target.value)} />
          <span className="self-center text-xs text-muted-foreground">دقيقة</span>
          <button type="button" className="btn-primary whitespace-nowrap" disabled={!!busy} onClick={() => void run("earlyCheckout")}>{busy === "earlyCheckout" ? "جارٍ…" : "تطبيق"}</button>
        </div>
      </div>
    </div>
    {message && <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>}
  </section>;
}
