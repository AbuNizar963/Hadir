import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getCurrentPosition, haversineMeters, type GeoPosition } from "@/lib/geo";
import { findEmployeeByJobNumber, getSettings } from "@/lib/storage";
import { recordAttendance } from "@/lib/attendance";
import { formatTime } from "@/lib/utils";

type Step = "gps" | "scan" | "submitting" | "success" | "error";

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export default function EmployeeScan() {
  const { type } = useParams<{ type: "check-in" | "check-out" }>();
  const nav = useNavigate();
  const session = currentSession();
  const settings = getSettings();
  const emp = session ? findEmployeeByJobNumber(session.jobNumber) : undefined;
  const action = type === "check-out" ? "check-out" : "check-in";

  const assignedLocation = settings.locations?.find((location) => location.id === emp?.locationId);
  const targetLat = assignedLocation?.lat ?? settings.workSiteLat;
  const targetLng = assignedLocation?.lng ?? settings.workSiteLng;
  const targetRadius = assignedLocation?.radiusMeters ?? settings.radiusMeters;
  const locationName = assignedLocation?.name ?? "المقر الرئيسي";

  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("gps");
  const [error, setError] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ time: string; late?: number; timeNote?: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const stopCamera = () => {
    scanningRef.current = false;
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("هذا المتصفح لا يدعم الكاميرا. يمكنك إدخال قيمة QR يدويًا.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const Detector = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
      if (!Detector) {
        setScannerSupported(false);
        return;
      }

      setScannerSupported(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanningRef.current = true;

      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes.find((code) => code.rawValue)?.rawValue?.trim();
          if (value) {
            setQrInput(value);
            setError(null);
            stopCamera();
            return;
          }
        } catch {
          // Continue scanning; a transient camera frame can fail to decode.
        }
        if (scanningRef.current) {
          scanFrameRef.current = window.setTimeout(() => {
            scan();
          }, 250) as unknown as number;
        }
      };

      void scan();
    } catch (cameraError) {
      console.error("تعذر فتح الكاميرا:", cameraError);
      setError("تعذر فتح الكاميرا. تأكد من منح صلاحية الكاميرا، أو أدخل قيمة QR يدويًا.");
      stopCamera();
    }
  };

  useEffect(() => {
    setScannerSupported(typeof window !== "undefined" && "BarcodeDetector" in window);

    let cancelled = false;
    (async () => {
      try {
        const position = await getCurrentPosition();
        if (cancelled) return;

        const currentDistance = haversineMeters(position, {
          lat: targetLat,
          lng: targetLng,
        });
        setPos(position);
        setDistance(currentDistance);

        if (currentDistance > targetRadius) {
          setError(`أنت خارج نطاق ${locationName} (${currentDistance} م / الحد ${targetRadius} م).`);
          setStep("error");
        } else {
          setStep("scan");
        }
      } catch (positionError) {
        if (cancelled) return;
        setError(positionError instanceof Error ? positionError.message : "تعذر الحصول على الموقع");
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [targetLat, targetLng, targetRadius, locationName]);

  const submit = () => {
    if (!pos || !session || !qrInput.trim()) return;
    setError(null);
    setStep("submitting");

    void (async () => {
      const response = await recordAttendance({
        jobNumber: session.jobNumber,
        type: action,
        position: pos,
        qrCode: qrInput.trim(),
      });

      if (!response.ok) {
        setError(response.reason ?? "تعذر تسجيل العملية");
        setStep("error");
        return;
      }

      setResult({
        time: response.record!.timestamp,
        late: response.lateMinutes,
        timeNote: response.timeNote,
      });
      setStep("success");
    })();
  };

  const title = action === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-5 py-5 flex items-center justify-between">
        <Brand />
        <Link to="/employee" className="btn-ghost text-xs" onClick={stopCamera}>
          إلغاء
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-5 pb-16 space-y-5">
        <section className="hud-card p-6">
          <div className="text-xs text-muted-foreground mono">ACTION</div>
          <h1 className="text-2xl font-extrabold mt-0.5">{title}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {session?.name ?? "الموظف"} · <span className="mono">{session?.jobNumber ?? "-"}</span> ·{" "}
            <span className="text-primary font-semibold">{locationName}</span>
          </div>
        </section>

        <section className="hud-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">١. التحقق من الموقع</div>
            <StepBadge
              state={
                step === "gps"
                  ? "active"
                  : distance !== null && distance <= targetRadius
                    ? "done"
                    : step === "error"
                      ? "fail"
                      : "done"
              }
            />
          </div>

          <LiveRadarView
            radius={targetRadius}
            distance={distance}
            state={
              step === "error" && (!pos || (distance ?? 0) > targetRadius)
                ? "out"
                : distance !== null
                  ? "in"
                  : "loading"
            }
          />

          <div className="grid grid-cols-3 gap-2 text-center mt-4 text-xs">
            <Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} />
            <Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} />
            <Cell label="المسافة" value={distance !== null ? `${distance} م` : "…"} />
          </div>
        </section>

        <section className={`hud-card p-6 ${step === "gps" ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">٢. مسح رمز QR</div>
            <StepBadge state={qrInput ? "done" : step === "scan" ? "active" : "idle"} />
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 p-6 text-center overflow-hidden">
            {isCameraActive ? (
              <div className="relative mx-auto h-56 w-full max-w-xs rounded-xl overflow-hidden bg-black border border-primary/50 shadow-inner">
                <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="h-32 w-32 border-2 border-dashed border-white/90 rounded-xl" />
                </div>
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
                  <span className="px-3 py-1.5 bg-black/70 text-white text-[11px] rounded-full">
                    {scannerSupported ? "وجّه الكاميرا نحو QR" : "المسح التلقائي غير مدعوم"}
                  </span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 bg-destructive text-white text-xs font-bold rounded-full"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mx-auto h-24 w-24 rounded-2xl bg-background grid place-items-center mb-3 border border-border/60 shadow-inner">
                  <QrIcon />
                </div>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-6">
                  امسح رمز QR المخصص لـ{locationName}. لا يتم قبول رموز عشوائية أو رموز من مواقع أخرى.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="btn-primary text-xs shadow"
                    disabled={step !== "scan"}
                  >
                    📷 فتح الكاميرا
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrInput(settings.qrCode)}
                    className="btn-secondary text-xs"
                    disabled={step !== "scan"}
                  >
                    إدخال القيمة يدويًا
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-xs text-muted-foreground mb-1" htmlFor="qr-code">
              قيمة QR
            </label>
            <input
              id="qr-code"
              className="input mono text-sm"
              placeholder="أدخل القيمة المطبوعة على QR"
              value={qrInput}
              onChange={(event) => setQrInput(event.target.value)}
              disabled={step === "gps" || step === "submitting"}
              autoComplete="off"
            />
          </div>
        </section>

        <section className="hud-card p-6">
          {step === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4">
              <div className="font-semibold text-destructive">فشل التحقق</div>
              <div className="text-xs text-muted-foreground mt-1">{error}</div>
            </div>
          )}

          {step === "success" && result && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm mb-4">
              <div className="font-extrabold text-primary text-lg">تمت العملية بنجاح</div>
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
              disabled={step !== "scan" || !qrInput.trim() || !pos}
            >
              {step === "submitting" ? "جاري التسجيل..." : `تأكيد ${title}`}
            </button>

            {step === "success" && (
              <button
                onClick={() => {
                  stopCamera();
                  nav("/employee");
                }}
                className="btn-secondary"
              >
                عودة
              </button>
            )}

            {step === "error" && (
              <button
                onClick={() => {
                  stopCamera();
                  nav("/employee");
                }}
                className="btn-secondary"
              >
                إلغاء
              </button>
            )}
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
  const status = map[state];
  return <span className={`badge ${status.c}`}>{status.t}</span>;
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

function LiveRadarView({
  radius,
  distance,
  state,
}: {
  radius: number;
  distance: number | null;
  state: "loading" | "in" | "out";
}) {
  const pct = distance === null || radius <= 0 ? 0 : Math.min(1, distance / (radius * 1.5));

  return (
    <div className="relative aspect-square max-w-[220px] mx-auto overflow-hidden">
      <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping opacity-20" style={{ animationDuration: "3s" }} />
      <div className="absolute inset-4 rounded-full border border-primary/40 animate-pulse" />
      <div className="absolute inset-12 rounded-full border border-primary/25" />

      {state === "loading" && (
        <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: "2s" }} />
      )}

      <div className="absolute inset-0 grid place-items-center">
        <div className={`h-3 w-3 rounded-full ${state === "out" ? "bg-destructive" : "bg-primary"}`} />
      </div>

      {distance !== null && (
        <div
          className={`absolute h-3 w-3 rounded-full ${state === "out" ? "bg-destructive animate-bounce" : "bg-accent animate-pulse"} shadow-lg transition-all duration-700`}
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
