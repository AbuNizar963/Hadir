import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getCurrentPosition, haversineMeters, type GeoPosition } from "@/lib/geo";
import { getSettings, findEmployeeByJobNumber } from "@/lib/storage";
import { recordAttendance } from "@/lib/attendance";
import { formatTime } from "@/lib/utils";

type Step = "gps" | "scan" | "submitting" | "success" | "error";

export default function EmployeeScan() {
  const { type } = useParams<{ type: "check-in" | "check-out" }>();
  const nav = useNavigate();
  const session = currentSession()!;
  const settings = getSettings();
  const emp = findEmployeeByJobNumber(session.jobNumber);
  const action = type === "check-out" ? "check-out" : "check-in";

  // تحديد الموقع المخصص للموظف أو المقر الرئيسي
  const assignedLocation = settings.locations?.find(
    (loc) => loc.id === emp?.locationId
  );

  const targetLat = assignedLocation ? assignedLocation.lat : settings.workSiteLat;
  const targetLng = assignedLocation ? assignedLocation.lng : settings.workSiteLng;
  const targetRadius = assignedLocation
    ? assignedLocation.radiusMeters
    : settings.radiusMeters;
  const locationName = assignedLocation ? assignedLocation.name : "المقر الرئيسي";

  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("gps");
  const [error, setError] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ time: string; late?: number; timeNote?: string } | null>(null);

  // تعريفات الكاميرا الحقيقية
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getCurrentPosition();
        if (cancelled) return;
        const d = haversineMeters(p, { lat: targetLat, lng: targetLng });
        setPos(p);
        setDistance(d);
        if (d > targetRadius) {
          setError(`أنت خارج نطاق ${locationName} (${d} م / الحد ${targetRadius} م).`);
          setStep("error");
        } else {
          setStep("scan");
        }
      } catch (e: any) {
        setError(e.message ?? "تعذّر الحصول على الموقع");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [targetLat, targetLng, targetRadius, locationName]);

  // دالة تشغيل الكاميرا
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("تعذر فتح الكاميرا:", err);
      setError("تعذر فتح الكاميرا، يرجى إدخال القيمة يدويًا.");
      setIsCameraActive(false);
    }
  };

  // دالة إيقاف الكاميرا
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // التقاط القيمة (سواء عبر الكاميرا أو المحاكاة)
  const captureCode = () => {
    setQrInput(settings.qrCode);
    stopCamera();
  };

  const submit = () => {
    if (!pos) return;
    setStep("submitting");
    (async () => {
      const r = await recordAttendance({
        jobNumber: session.jobNumber,
        type: action,
        position: pos,
        qrCode: qrInput.trim(),
      });
      if (!r.ok) {
        setError(r.reason ?? "تعذّر تسجيل العملية");
        setStep("error");
        return;
      }
      setResult({
        time: r.record!.timestamp,
        late: r.lateMinutes,
        timeNote: r.timeNote,
      });
      setStep("success");
    })();
  };

  const title = action === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-5 py-5 flex items-center justify-between">
        <Brand />
        <Link to="/employee" className="btn-ghost text-xs" onClick={stopCamera}>إلغاء</Link>
      </header>

      <main className="max-w-xl mx-auto px-5 pb-16 space-y-5">
        <section className="hud-card p-6">
          <div className="text-xs text-muted-foreground mono">ACTION</div>
          <h1 className="text-2xl font-extrabold mt-0.5">{title}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {session.name} · <span className="mono">{session.jobNumber}</span> ·{" "}
            <span className="text-primary font-semibold">{locationName}</span>
          </div>
        </section>

        {/* GPS card مع رادار نابض */}
        <section className="hud-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">١. التحقق من الموقع</div>
            <StepBadge state={step === "gps" ? "active" : distance !== null && distance <= targetRadius ? "done" : step === "error" && pos === null ? "fail" : "done"} />
          </div>
          
          <LiveRadarView radius={targetRadius} distance={distance} state={step === "error" && (!pos || (distance ?? 0) > targetRadius) ? "out" : distance !== null ? "in" : "loading"} />

          <div className="grid grid-cols-3 gap-2 text-center mt-4 text-xs">
            <Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} />
            <Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} />
            <Cell label="المسافة" value={distance !== null ? `${distance} م` : "…"} />
          </div>
        </section>

        {/* QR card مع الكاميرا الحقيقية */}
        <section className={`hud-card p-6 ${step === "gps" ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">٢. مسح رمز QR</div>
            <StepBadge state={qrInput ? "done" : step === "scan" ? "active" : "idle"} />
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 p-6 text-center overflow-hidden">
            {isCameraActive ? (
              <div className="relative mx-auto h-48 w-full max-w-xs rounded-xl overflow-hidden bg-black border border-primary/50 shadow-inner">
                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                <div className="absolute inset-0 border-2 border-primary/70 animate-pulse grid place-items-center pointer-events-none">
                  <div className="w-32 h-32 border border-dashed border-white/80 rounded-lg"></div>
                </div>
                <button
                  type="button"
                  onClick={captureCode}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg"
                >
                  التقاط القيمة فوراً
                </button>
              </div>
            ) : (
              <>
                <div className="mx-auto h-24 w-24 rounded-2xl bg-background grid place-items-center mb-3 border border-border/60 shadow-inner animate-bounce">
                  <QrIcon />
                </div>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-6">
                  قم بمسح رمز QR الملصَق داخل {locationName} باستخدام الكاميرا، أو أدخل قيمته يدويًا.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <button onClick={startCamera} className="btn-primary text-xs shadow" disabled={step !== "scan"}>
                    📷 فتح الكاميرا
                  </button>
                  <button onClick={captureCode} className="btn-secondary text-xs" disabled={step !== "scan"}>
                    محاكاة المسح
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-xs text-muted-foreground mb-1">قيمة QR</label>
            <input
              className="input mono text-sm"
              placeholder="HADIR-SITE-01-STATIC"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              disabled={step === "gps"}
            />
          </div>
        </section>

        {/* Actions */}
        <section className="hud-card p-6">
          {step === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4">
              <div className="font-semibold text-destructive">فشل التحقق</div>
              <div className="text-xs text-muted-foreground mt-1">{error}</div>
            </div>
          )}
          {step === "success" && result && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm mb-4">
              <div className="font-extrabold text-primary text-lg">
                تمت العملية بنجاح
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {title} في {formatTime(result.time)}
                {result.timeNote ? ` · ${result.timeNote}` : ""}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="btn-primary flex-1 py-3"
              onClick={submit}
              disabled={step !== "scan" || !qrInput}
            >
              {step === "submitting" ? "جاري الإرسال..." : `تأكيد ${title}`}
            </button>
            {step === "success" ? (
              <button onClick={() => { stopCamera(); nav("/employee"); }} className="btn-secondary">
                عودة
              </button>
            ) : null}
            {step === "error" ? (
              <button onClick={() => { stopCamera(); nav("/employee"); }} className="btn-secondary">
                إلغاء
              </button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function StepBadge({ state }: { state: "idle" | "active" | "done" | "fail" }) {
  const map = {
    idle: { c: "bg-secondary text-muted-foreground", t: "في الانتظار" },
    active: { c: "bg-accent/15 text-accent animate-pulse", t: "جارٍ..." },
    done: { c: "bg-primary/15 text-primary", t: "تم" },
    fail: { c: "bg-destructive/15 text-destructive", t: "فشل" },
  } as const;
  const s = map[state];
  return <span className={`badge ${s.c}`}>{s.t}</span>;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 border border-border/50 p-2">
      <div className="text-[10px] text-muted-foreground mono">{label}</div>
      <div className="font-semibold mono mt-0.5">{value}</div>
    </div>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3z" />
      <path d="M20 14v3" />
      <path d="M14 20h3" />
      <path d="M17 20v1" />
      <path d="M20 20v1" />
    </svg>
  );
}

// واجهة رادار نابضة بالحياة وتتحرك بصرياً
function LiveRadarView({
  radius,
  distance,
  state,
}: {
  radius: number;
  distance: number | null;
  state: "loading" | "in" | "out";
}) {
  const pct = distance === null ? 0 : Math.min(1, distance / (radius * 1.5));
  return (
    <div className="relative aspect-square max-w-[220px] mx-auto overflow-hidden">
      <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping opacity-20" style={{ animationDuration: "3s" }} />
      <div className="absolute inset-4 rounded-full border border-primary/40 animate-pulse" />
      <div className="absolute inset-12 rounded-full border border-primary/25" />
      
      {state === "loading" && (
        <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: "2s" }} />
      )}

      <div className="absolute inset-0 grid place-items-center">
        <div className={`h-3 w-3 rounded-full ${state === "out" ? "bg-destructive" : "bg-primary"} shadow-[0_0_12px_rgba(var(--primary),0.8)]`} />
      </div>

      {distance !== null && (
        <div
          className={`absolute h-3 w-3 rounded-full ${
            state === "out" ? "bg-destructive animate-bounce" : "bg-accent animate-pulse"
          } shadow-lg transition-all duration-700`}
          style={{
            top: `${50 - pct * 45}%`,
            left: `${50 + pct * 35}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center mt-16 bg-background/60 backdrop-blur-sm px-3 py-1 rounded-full border border-border/40 shadow">
          <div className="mono text-[10px] text-muted-foreground">حالة الموقع</div>
          <div className={`font-extrabold text-xs mt-0.5 ${state === "out" ? "text-destructive" : state === "in" ? "text-primary" : "text-muted-foreground"}`}>
            {state === "loading" ? "جارٍ التقاط الإشارة..." : state === "in" ? "✓ داخل النطاق" : "✕ خارج النطاق"}
          </div>
        </div>
      </div>
    </div>
  );
}
