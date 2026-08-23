import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Camera, ImagePlus, KeyRound, ShieldCheck } from "lucide-react";
import { currentSession } from "@/lib/auth";
import { getBackendEmployeeProfile } from "@/lib/backend";
import { compressProfileImageDataUrl } from "@/lib/imageCompression";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const deviceId = () => localStorage.getItem("hadir.device.id") || "";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("تعذر قراءة الصورة."));
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة من الجهاز."));
    reader.readAsDataURL(file);
  });
}

async function saveProfile(body: Record<string, unknown>) {
  const token = localStorage.getItem("hadir.api.token.employee") || "";
  if (!token) throw new Error("جلسة الموظف غير موجودة. يرجى تسجيل الدخول مرة أخرى.");

  const res = await fetch(`${API_URL}/api/workforce/live`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-device-id": deviceId(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "تعذر حفظ الملف الشخصي");
  }
  return data;
}

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const session = currentSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(session?.name || "");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getBackendEmployeeProfile()
      .then((profile) => {
        setName(profile.name);
        setAvatar(profile.avatar || null);
      })
      .catch(() => undefined);
  }, []);

  const openPhotoPicker = () => {
    setError("");
    setMessage("");
    fileInputRef.current?.click();
  };

  const photo = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("اختر صورة فقط من ألبوم الصور.");
      return;
    }

    setPhotoSaving(true);
    setError("");
    setMessage("");

    try {
      const original = await fileToDataUrl(file);
      const compressed = await compressProfileImageDataUrl(original, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.78,
        minQuality: 0.45,
        type: "image/webp",
        maxBytes: 100 * 1024,
      });

      await saveProfile({ avatar: compressed });
      setAvatar(compressed);
      setMessage("تم حفظ الصورة الشخصية بنجاح.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الصورة الشخصية.");
    } finally {
      setPhotoSaving(false);
    }
  };

  const password = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 4) return setError("كلمة السر يجب أن تتكون من 4 أحرف/أرقام على الأقل.");
    if (newPassword !== confirm) return setError("تأكيد كلمة السر غير مطابق.");

    setSaving(true);
    try {
      await saveProfile({ password: newPassword });
      setNewPassword("");
      setConfirm("");
      setMessage("تم تغيير كلمة السر بنجاح");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تغيير كلمة السر");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold">
          <ArrowRight className="h-4 w-4" /> العودة
        </button>

        <section className="hud-card overflow-hidden p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border-2 border-primary/30 bg-primary/10 text-3xl font-black text-primary">
                {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : name.charAt(0) || "م"}
              </div>

              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={photoSaving}
                aria-label="اختيار صورة شخصية من الصور"
                title="اختيار صورة من الصور"
                className="absolute -bottom-2 -left-2 grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg transition hover:scale-105 disabled:cursor-wait disabled:opacity-60"
              >
                {photoSaving ? <span className="text-xs font-black">…</span> : <Camera className="h-5 w-5" />}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={photo}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <div>
              <div className="text-xs text-muted-foreground">الملف الشخصي</div>
              <h1 className="text-2xl font-black">{name}</h1>
              <p className="mt-1 text-xs text-muted-foreground">يمكنك تغيير صورتك وكلمة السر الخاصة بحسابك.</p>
              <button type="button" onClick={openPhotoPicker} disabled={photoSaving} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50">
                <ImagePlus className="h-4 w-4" /> {photoSaving ? "جاري حفظ الصورة…" : "اختيار صورة من الصور"}
              </button>
            </div>
          </div>
        </section>

        <section className="hud-card p-6">
          <div className="flex items-center gap-2 font-black">
            <KeyRound className="h-5 w-5 text-primary" /> تغيير كلمة السر
          </div>
          <form onSubmit={password} className="mt-5 space-y-4">
            <input className="input w-full" type="password" autoComplete="new-password" placeholder="كلمة السر الجديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <input className="input w-full" type="password" autoComplete="new-password" placeholder="تأكيد كلمة السر" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className="btn-primary w-full" disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ كلمة السر"}</button>
          </form>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> تُحفظ كلمة السر في الخادم باستخدام PBKDF2 ولا يتم تخزينها كنص مكشوف.
          </div>
          {message && <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}
          {error && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </section>
      </div>
    </main>
  );
}
