import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BrowserQRCodeReader } from "@zxing/browser";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { recordAttendance } from "@/lib/attendance";
import { getCurrentPosition, type GeoPosition } from "@/lib/geo";
import { getSettings } from "@/lib/storage";
import { formatTime } from "@/lib/utils";
import type { Settings } from "@/types";

type ScanStep =
  | "camera"
  | "qr-verified"
  | "locating"
  | "submitting"
  | "success"
  | "error";

type AttendanceResult = {
  timestamp: string;
  distance?: number;
  timeNote?: string;
};

type ScannerControls = {
  stop: () => void;
};

const SUCCESS_REDIRECT_MS = 2200;

export default function EmployeeScan() {
  const { type } = useParams<{ type: "check-in" | "check-out" }>();
  const navigate = useNavigate();
  const [session] = useState(() => currentSession());
  const [settings] = useState<Settings>(() => getSettings());
  const [step, setStep] = useState<ScanStep>("camera");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const redirectTimerRef = useRef<number | null>(null);

  const action = type === "check-out" ? "check-out" : "check-in";
  const title = action === "check-out" ? "تسجيل الانصراف" : "تسجيل الحضور";

  const stopScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  const verifyLocationAndSubmit = useCallback(
    async (scannedQr: string) => {
      if (!session) {
        setStep("error");
        setError("انتهت جلسة الموظف. يرجى تسجيل الدخول مرة أخرى.");
        return;
      }

      setStep("locating");
      setError(null);

      let position: GeoPosition;
      try {
        position = await getCurrentPosition();
      } catch (locationError) {
        if (!mountedRef.current) return;

        setStep("error");
        setError(
          locationError instanceof Error
            ? locationError.message
            : "تعذر تحديد موقعك الحالي. تأكد من تفعيل خدمة الموقع ومنح المتصفح صلاحيتها.",
        );
        return;
      }

      if (!mountedRef.current) return;

      setStep("submitting");
      setError(null);

      try {
        const response = await recordAttendance({
          jobNumber: session.jobNumber,
          type: action,
          position,
          qrCode: scannedQr,
        });

        if (!mountedRef.current) return;

        if (!response.ok || !response.record) {
          setStep("error");
          setError(response.reason ?? "تعذر تسجيل العملية.");
          return;
        }

        stopScanner();
        setResult({
          timestamp: response.record.timestamp,
          distance: response.distance,
          timeNote: response.timeNote,
        });
        setStep("success");

        redirectTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            navigate("/employee", { replace: true });
          }
        }, SUCCESS_REDIRECT_MS);
      } catch (submitError) {
        if (!mountedRef.current) return;

        setStep("error");
        setError(
          submitError instanceof Error
            ? submitError.message
            : "تعذر تسجيل العملية. حاول مرة أخرى.",
        );
      }
    },
    [action, navigate, session, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (!mountedRef.current || !videoRef.current) return;

    stopScanner();
    scanHandledRef.current = false;
    setError(null);
    setStep("camera");
    setCameraReady(false);

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
          },
        },
        videoRef.current,
        (scanResult) => {
          if (!scanResult || scanHandledRef.current || !mountedRef.current) {
            return;
          }

          const value = scanResult.getText().trim();
          if (!value) return;

          scanHandledRef.current = true;
          scannerControlsRef.current?.stop();
          scannerControlsRef.current = null;
          setError(null);

          const expectedQr = String(settings.qrCode || "").trim();
          if (expectedQr && value !== expectedQr) {
            scanHandledRef.current = false;
            setError(
              "رمز QR غير صحيح أو لا يخص موقع العمل. حاول مسح الرمز الموجود في مقر العمل.",
            );
            window.setTimeout(() => {
              if (mountedRef.current) {
                void startScanner();
              }
            }, 900);
            return;
          }

          setStep("qr-verified");
          void verifyLocationAndSubmit(value);
        },
      );

      if (!mountedRef.current) {
        controls.stop();
        return;
      }

      scannerControlsRef.current = controls;
      setCameraReady(true);
    } catch (scannerError) {
      if (!mountedRef.current) return;

      console.error("تعذر تشغيل ماسح QR:", scannerError);
      setCameraReady(false);
      setStep("error");
      setError(
        "تعذر فتح الكاميرا. تأكد من منح صلاحية الكاميرا واستخدام اتصال HTTPS، ثم أعد المحاولة.",
      );
    }
  }, [settings.qrCode, stopScanner, verifyLocationAndSubmit]);

  useEffect(() => {
    mountedRef.current = true;
    void startScanner();

    return () => {
      mountedRef.current = false;
      stopScanner();
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [startScanner, stopScanner]);

  const retry = () => {
    setIsRetrying(true);
    setResult(null);
    void startScanner().finally(() => {
      if (mountedRef.current) {
        setIsRetrying(false);
      }
    });
  };

  const close = () => {
    stopScanner();
    navigate("/employee");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={close}
          className="h-10 rounded-xl border border-border/70 bg-secondary/60 px-3 text-sm font-bold transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="العودة إلى الصفحة الرئيسية"
        >
          رجوع
        </button>
        <Brand />
        <div className="w-16" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-xl px-4 pb-10 sm:px-5">
        <section className="mb-4 text-center">
          <div className="text-xs font-bold tracking-widest text-muted-foreground">
            {action === "check-in" ? "CHECK IN" : "CHECK OUT"}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session?.name ?? "الموظف"} · {session?.jobNumber ?? "-"}
          </p>
        </section>

        {step === "camera" && (
          <section className="overflow-hidden rounded-3xl border border-border/70 bg-black shadow-xl">
            <div className="relative aspect-[3/4] min-h-[520px] w-full sm:min-h-[620px]">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                playsInline
                autoPlay
              />

              <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

              <div className="absolute inset-x-0 top-0 z-10 px-5 pt-5 text-center text-white">
                <div className="text-lg font-extrabold">امسح رمز QR</div>
                <div className="mt-1 text-xs text-white/75">
                  وجّه الكاميرا نحو رمز QR الموجود في مقر العمل
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-8">
                <div className="relative aspect-square w-full max-w-[320px] rounded-[30px] border-[3px] border-primary shadow-[0_0_35px_hsl(var(--primary)/.35),0_0_0_9999px_rgba(0,0,0,.28)]">
                  <span className="absolute -left-1 -top-1 h-12 w-12 rounded-tl-[28px] border-l-[5px] border-t-[5px] border-primary" />
                  <span className="absolute -right-1 -top-1 h-12 w-12 rounded-tr-[28px] border-r-[5px] border-t-[5px] border-primary" />
                  <span className="absolute -bottom-1 -left-1 h-12 w-12 rounded-bl-[28px] border-b-[5px] border-l-[5px] border-primary" />
                  <span className="absolute -bottom-1 -right-1 h-12 w-12 rounded-br-[28px] border-b-[5px] border-r-[5px] border-primary" />
                  <span className="absolute inset-x-[10%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                <div className="mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/60 p-4 text-center text-white backdrop-blur-md">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                    {cameraReady ? "جارٍ البحث عن رمز QR..." : "جارٍ تشغيل الكاميرا..."}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-white/70">
                    لن يتم طلب الموقع إلا بعد قراءة رمز QR بنجاح.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === "qr-verified" && (
          <StatusCard
            icon="✓"
            title="تمت قراءة رمز QR"
            description="تم التعرف على رمز الموقع. الآن سنحدد موقعك للتأكد من وجودك داخل نطاق العمل."
          />
        )}

        {step === "locating" && (
          <StatusCard
            icon="⌖"
            title="جارٍ تحديد موقعك"
            description="يرجى الانتظار لحظات حتى يتم الحصول على موقع جهازك والتحقق من نطاق مقر العمل."
            loading
          />
        )}

        {step === "submitting" && (
          <StatusCard
            icon="…"
            title="جارٍ تسجيل العملية"
            description="تم تحديد موقعك. جارٍ الآن التحقق النهائي وحفظ العملية في النظام."
            loading
          />
        )}

        {step === "success" && result && (
          <section className="rounded-3xl border border-primary/30 bg-primary/10 p-7 text-center shadow-lg">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-primary/40 bg-primary/15 text-4xl text-primary">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-extrabold text-primary">
              تم تسجيل {action === "check-in" ? "حضورك" : "انصرافك"} بنجاح
            </h2>
            <div className="mt-3 text-sm text-muted-foreground">
              الساعة {formatTime(result.timestamp)}
            </div>
            {result.distance !== undefined && Number.isFinite(result.distance) && (
              <div className="mt-1 text-xs text-muted-foreground">
                المسافة عن مقر العمل: {Math.round(result.distance)} م
              </div>
            )}
            {result.timeNote && (
              <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs font-semibold">
                {result.timeNote}
              </div>
            )}
            <p className="mt-5 text-xs text-muted-foreground">
              سيتم إعادتك إلى الصفحة الرئيسية تلقائيًا.
            </p>
          </section>
        )}

        {step === "error" && (
          <section className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-3xl text-destructive">
              !
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-destructive">
              تعذر إتمام {action === "check-in" ? "الحضور" : "الانصراف"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {error ?? "حدث خطأ غير متوقع. حاول مرة أخرى."}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={retry}
                disabled={isRetrying}
                className="btn-primary px-6 py-3"
              >
                {isRetrying ? "جاري إعادة التشغيل..." : "إعادة المحاولة"}
              </button>
              <button
                type="button"
                onClick={close}
                className="btn-secondary px-6 py-3"
              >
                العودة للرئيسية
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  loading = false,
}: {
  icon: string;
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-8 text-center shadow-lg">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-primary/30 bg-primary/10 text-3xl font-black text-primary">
        {loading ? <span className="animate-pulse">{icon}</span> : icon}
      </div>
      <h2 className="mt-5 text-2xl font-extrabold">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      {loading && (
        <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      )}
    </section>
  );
}
