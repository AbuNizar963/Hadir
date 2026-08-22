import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getCurrentPosition, haversineMeters, type GeoPosition } from "@/lib/geo";
import { getSettings } from "@/lib/storage";
import { getBackendEmployeeLocation } from "@/lib/backend";
import { recordAttendance } from "@/lib/attendance";
import { formatTime } from "@/lib/utils";
import type { Settings } from "@/types";

type Step = "loading-location" | "gps" | "scan" | "submitting" | "success" | "error";
type LocationConfig = { id: string; name: string; lat: number; lng: number; radiusMeters: number };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
declare global { interface Window { BarcodeDetector?: BarcodeDetectorConstructor } }

export default function EmployeeScan() {
  const { type } = useParams<{ type: "check-in" | "check-out" }>();
  const nav = useNavigate();
  const session = currentSession();
  const action = type === "check-out" ? "check-out" : "check-in";
  const [settings] = useState<Settings>(() => getSettings());
  const [location, setLocation] = useState<LocationConfig | null>(null);
  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("loading-location");
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ time: string; timeNote?: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setStep("loading-location");
    setError(null);
    void getBackendEmployeeLocation().then(({ location: remote }) => {
      if (cancelled) return;
      const next = { id: String(remote.id || "main"), name: String(remote.name || "المقر الرئيسي"), lat: Number(remote.lat), lng: Number(remote.lng), radiusMeters: Number(remote.radiusMeters) };
      if (![next.lat, next.lng, next.radiusMeters].every(Number.isFinite) || next.radiusMeters <= 0) throw new Error("بيانات موقع العمل القادمة من قاعدة بيانات D1 غير صالحة");
      setLocation(next);
      setStep("gps");
    }).catch((e) => {
      if (cancelled) return;
      setLocation(null);
      setError(e instanceof Error ? e.message : "تعذر تحميل موقع العمل من قاعدة بيانات D1");
      setStep("error");
    });
    return () => { cancelled = true; };
  }, []);

  const targetLat = location?.lat ?? NaN;
  const targetLng = location?.lng ?? NaN;
  const targetRadius = location?.radiusMeters ?? NaN;
  const locationName = location?.name || "المقر الرئيسي";

  const stopCamera = () => {
    scanningRef.current = false;
    if (scanTimerRef.current !== null) { window.clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
    setTorchSupported(false);
    setTorchOn(false);
  };

  const refreshGps = async () => {
    if (!location) {
      setError("لم يتم تحميل موقع العمل من قاعدة بيانات D1 بعد.");
      return;
    }
    if (![targetLat, targetLng, targetRadius].every(Number.isFinite) || targetRadius <= 0) {
      setError("إعدادات موقع العمل في قاعدة بيانات D1 غير صالحة.");
      setStep("error");
      return;
    }
    setIsLocating(true);
    setError(null);
    setStep("gps");
    try {
      const position = await getCurrentPosition();
      const nextDistance = haversineMeters(position, { lat: targetLat, lng: targetLng });
      setPos(position);
      setDistance(nextDistance);
      if (nextDistance > targetRadius) {
        setError(`أنت خارج نطاق مقر العمل. المسافة الحالية: ${nextDistance} م (الحد المسموح: ${targetRadius} م)`);
        setStep("error");
        return;
      }
      setStep("scan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحصول على موقعك الحالي");
      setStep("error");
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    setScannerSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  const inRange = distance !== null && Number.isFinite(distance) && distance <= targetRadius;

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError("هذا المتصفح لا يدعم الكاميرا. يمكنك إدخال قيمة QR يدويًا."); return; }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 } }, audio: false });
      mediaStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean } | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
      setIsCameraActive(true);
    } catch (e) { console.error("تعذر فتح الكاميرا:", e); setError("تعذر فتح الكاميرا. تأكد من منح صلاحية الكاميرا واستخدام HTTPS، أو أدخل قيمة QR يدويًا."); stopCamera(); }
  };

  const toggleTorch = async () => {
    const track = mediaStreamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { setError("لا يمكن تشغيل إضاءة الكاميرا على هذا الجهاز."); }
  };

  useEffect(() => {
    if (!isCameraActive || !mediaStreamRef.current || !videoRef.current) return;
    let cancelled = false;
    const video = videoRef.current;
    video.srcObject = mediaStreamRef.current;
    void video.play().catch((e) => console.warn("تعذر تشغيل معاينة الكاميرا تلقائيًا:", e));
    const Detector = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
    if (!Detector) { setScannerSupported(false); return () => { cancelled = true; }; }
    setScannerSupported(true);
    const detector = new Detector({ formats: ["qr_code"] });
    scanningRef.current = true;
    const scan = async () => {
      if (cancelled || !scanningRef.current || !videoRef.current || video.readyState < 2) {
        if (!cancelled && scanningRef.current) scanTimerRef.current = window.setTimeout(() => void scan(), 250);
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes.find((code) => code.rawValue)?.rawValue?.trim();
        if (value) { setQrInput(value); stopCamera(); return; }
      } catch { /* keep scanning */ }
      if (!cancelled && scanningRef.current) scanTimerRef.current = window.setTimeout(() => void scan(), 250);
    };
    scanTimerRef.current = window.setTimeout(() => void scan(), 300);
    return () => { cancelled = true; scanningRef.current = false; if (scanTimerRef.current !== null) { window.clearTimeout(scanTimerRef.current); scanTimerRef.current = null; } };
  }, [isCameraActive]);

  const submit = () => {
    if (!pos || !session || !qrInput.trim()) return;
    if (!inRange) { setError(`أنت خارج نطاق مقر العمل. المسافة الحالية: ${distance ?? "غير معروفة"} م (الحد المسموح: ${targetRadius} م)`); setStep("error"); return; }
    setError(null); setStep("submitting");
    void (async () => {
      const response = await recordAttendance({ jobNumber: session.jobNumber, type: action, position: pos, qrCode: qrInput.trim() });
      if (!response.ok) { setError(response.reason ?? "تعذر تسجيل العملية"); setStep("error"); return; }
      setResult({ time: response.record!.timestamp, timeNote: response.timeNote }); setStep("success");
    })();
  };

  const title = action === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف";
  const statusText = step === "loading-location" ? "جاري تحميل موقع الشركة" : isLocating ? "جاري تحديد موقعك..." : step === "error" ? "تعذر التحقق من الموقع" : step === "gps" ? "اضغط لتحديد موقعك" : inRange ? "تم التحقق من الموقع" : "خارج نطاق الموقع";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-5 py-5 flex items-center justify-between"><Brand /><Link to="/employee" className="btn-ghost text-xs" onClick={stopCamera}>إلغاء</Link></header>
      <main className="max-w-xl mx-auto px-5 pb-16 space-y-5">
        <section className="hud-card p-6"><div className="text-xs text-muted-foreground mono">ACTION</div><h1 className="text-2xl font-extrabold mt-0.5">{title}</h1><div className="text-sm text-muted-foreground mt-1">{session?.name ?? "الموظف"} · <span className="mono">{session?.jobNumber ?? "-"}</span> · <span className="text-primary font-semibold">{locationName}</span></div></section>
        <section className="hud-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold">١. التحقق من الموقع</div><StepBadge state={step === "loading-location" || step === "gps" || isLocating ? "active" : step === "error" ? "fail" : "done"} /></div>
          <div className="relative mx-auto w-full max-w-[250px] aspect-square rounded-full border border-primary/25 bg-primary/[0.035] overflow-hidden grid place-items-center shadow-[0_0_40px_hsl(var(--primary)/.08)]">
            <div className="absolute inset-[8%] rounded-full border border-primary/15" /><div className="absolute inset-[20%] rounded-full border border-primary/20" /><div className="absolute inset-[33%] rounded-full border border-primary/25" /><div className="absolute inset-[44%] rounded-full border border-primary/30" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/10" /><div className="absolute top-1/2 left-0 right-0 h-px bg-primary/10" /><div className="absolute inset-0 radar-sweep opacity-80" />
            <div className="radar-core" /><div className="absolute bottom-5 rounded-full bg-background/80 border border-border/50 px-3 py-1 text-[10px] mono text-muted-foreground backdrop-blur">LIVE LOCATION</div>
          </div>
          <div className="text-center mt-4"><div className="text-base font-extrabold radar-status">{statusText}</div><div className="text-xs text-muted-foreground mt-1">{step === "loading-location" ? "يتم تحميل إحداثيات الشركة والنطاق من قاعدة بيانات D1..." : isLocating ? "اسمح للمتصفح بالوصول إلى موقعك الحالي..." : step === "gps" || step === "error" ? "اضغط الزر لتحديد موقعك ومقارنته بموقع العمل المحفوظ في D1." : "تم التحقق من موقع جهازك ومقارنته بموقع العمل."}</div></div>
          <button type="button" onClick={() => void refreshGps()} disabled={isLocating || !location} className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2">
            {isLocating ? <><span className="animate-spin">⟳</span> جاري تحديد موقعي...</> : <>📍 تحديد موقعي الحالي</>}
          </button>
          <div className="grid grid-cols-2 gap-2 text-center mt-4 text-xs"><Cell label="المسافة الحالية" value={distance !== null ? `${Math.round(distance)} م` : "…"} /><Cell label="النطاق المسموح" value={Number.isFinite(targetRadius) ? `${Math.round(targetRadius)} م` : "…"} /><Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} /><Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} /></div>
          {distance !== null && !inRange && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive font-semibold">الموقع خارج النطاق؛ لن يتم السماح بتسجيل الحضور.</div>}
        </section>
        <section className={`hud-card p-6 ${!inRange ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold">٢. مسح رمز QR</div><StepBadge state={qrInput ? "done" : step === "scan" && inRange ? "active" : "idle"} /></div>
          <div className="rounded-2xl border border-border/70 bg-background overflow-hidden text-center">
            {isCameraActive ? <div className="relative min-h-[68vh] sm:min-h-[560px] w-full bg-black overflow-hidden">
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-0 bg-black/15 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 text-white">
                <div><div className="text-sm font-bold">مسح رمز QR</div><div className="text-[11px] text-white/70 mt-0.5">ضع الرمز داخل الإطار</div></div>
                <button type="button" onClick={stopCamera} className="h-10 w-10 rounded-full bg-black/55 border border-white/20 grid place-items-center text-lg" aria-label="إغلاق الكاميرا">×</button>
              </div>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="relative w-[78vw] max-w-[340px] aspect-square">
                  <div className="absolute inset-0 rounded-[28px] border border-white/15" />
                  <div className="absolute -inset-px rounded-[28px] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.18),0_0_36px_rgba(255,255,255,.18)]" />
                  <div className="absolute left-0 top-0 h-12 w-12 border-l-4 border-t-4 border-white rounded-tl-2xl" />
                  <div className="absolute right-0 top-0 h-12 w-12 border-r-4 border-t-4 border-white rounded-tr-2xl" />
                  <div className="absolute left-0 bottom-0 h-12 w-12 border-l-4 border-b-4 border-white rounded-bl-2xl" />
                  <div className="absolute right-0 bottom-0 h-12 w-12 border-r-4 border-b-4 border-white rounded-br-2xl" />
                  <div className="absolute left-4 right-4 top-1/2 h-px bg-white/90 shadow-[0_0_12px_rgba(255,255,255,.8)] animate-pulse" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                <div className="mx-auto max-w-sm rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 p-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse shrink-0" />
                  <span className="text-xs text-white/90 flex-1 text-right">{scannerSupported ? "وجّه الكاميرا نحو رمز QR وسيتم التعرف عليه تلقائيًا" : "الكاميرا تعمل، لكن المسح التلقائي غير مدعوم في هذا المتصفح"}</span>
                  {torchSupported && <button type="button" onClick={() => void toggleTorch()} className={`h-10 w-10 shrink-0 rounded-xl border text-base ${torchOn ? "bg-white text-black border-white" : "bg-white/10 text-white border-white/20"}`} aria-label={torchOn ? "إطفاء الإضاءة" : "تشغيل الإضاءة"}>⌁</button>}
                </div>
                <button type="button" onClick={stopCamera} className="mt-2 w-full max-w-sm mx-auto block rounded-xl bg-white/10 border border-white/20 text-white py-2.5 text-xs font-bold">إغلاق الكاميرا</button>
              </div>
            </div> : <div className="p-6 sm:p-8"><div className="mx-auto h-20 w-20 rounded-2xl bg-secondary grid place-items-center mb-4 border border-border/60"><QrIcon /></div><p className="text-sm font-semibold">امسح رمز QR المخصص لـ{locationName}</p><p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1.5 leading-6">افتح الكاميرا ووجّه الرمز داخل الإطار. سيتم التعرف عليه تلقائيًا دون الحاجة للضغط على زر الالتقاط.</p><div className="flex flex-col sm:flex-row justify-center gap-2 mt-5"><button type="button" onClick={() => void startCamera()} className="btn-primary text-xs shadow" disabled={step !== "scan" || !inRange}>📷 فتح ماسح QR</button><button type="button" onClick={() => setQrInput(settings.qrCode || "")} className="btn-secondary text-xs" disabled={step !== "scan" || !inRange || !settings.qrCode}>إدخال القيمة يدويًا</button></div></div>}
          </div>
          <div className="mt-4"><label className="block text-xs text-muted-foreground mb-1" htmlFor="qr-code">قيمة QR</label><input id="qr-code" className="input mono text-sm" placeholder="أدخل القيمة المطبوعة على QR" value={qrInput} onChange={(e) => setQrInput(e.target.value)} disabled={step !== "scan" || !inRange} autoComplete="off" /></div>
        </section>
        <section className="hud-card p-6">
          {step === "error" && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4"><div className="font-semibold text-destructive">فشل التحقق</div><div className="text-xs text-muted-foreground mt-1">{error}</div></div>}
          {step === "success" && result && <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm mb-4"><div className="font-extrabold text-primary text-lg">تمت العملية بنجاح</div><div className="text-xs text-muted-foreground mt-1">{title} في {formatTime(result.time)}{result.timeNote ? ` · ${result.timeNote}` : ""}</div></div>}
          <div className="flex gap-3"><button className="btn-primary flex-1 py-3" onClick={submit} disabled={step !== "scan" || !inRange || !qrInput.trim() || !pos}>{step === "submitting" ? "جاري التسجيل..." : `تأكيد ${title}`}</button>{(step === "success" || step === "error") && <button onClick={() => { stopCamera(); nav("/employee"); }} className="btn-secondary">عودة</button>}</div>
        </section>
      </main>
    </div>
  );
}

function StepBadge({ state }: { state: "idle" | "active" | "done" | "fail" }) { const map = { idle: { c: "bg-secondary text-muted-foreground", t: "في الانتظار" }, active: { c: "bg-accent/15 text-accent animate-pulse", t: "جاري..." }, done: { c: "bg-primary/15 text-primary", t: "تم" }, fail: { c: "bg-destructive/15 text-destructive", t: "فشل" } } as const; const status = map[state]; return <span className={`badge ${status.c}`}>{status.t}</span>; }
function Cell({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/40 border border-border/50 p-2"><div className="text-[10px] text-muted-foreground mono">{label}</div><div className="font-semibold mono mt-0.5">{value}</div></div>; }
function QrIcon() { return <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2v2h-2z" /></svg>; }
