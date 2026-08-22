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

const CONFIRMATION_WINDOW_MS = 60_000;

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
  const [confirmationExpiresAt, setConfirmationExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
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
      if (![next.lat, next.lng, next.radiusMeters].every(Number.isFinite) || next.radiusMeters <= 0) throw new Error("بيانات موقع العمل القادمة من الخادم غير صالحة");
      setLocation(next);
      setStep("gps");
    }).catch((e) => {
      if (cancelled) return;
      setLocation(null);
      setError(e instanceof Error ? e.message : "تعذر تحميل موقع العمل من الخادم");
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
    if (!location) { setError("لم يتم تحميل موقع العمل من الخادم بعد."); return; }
    if (![targetLat, targetLng, targetRadius].every(Number.isFinite) || targetRadius <= 0) {
      setError("إعدادات موقع العمل في الخادم غير صالحة");
      setStep("error");
      return;
    }
    setIsLocating(true);
    setError(null);
    setConfirmationExpiresAt(null);
    setRemainingSeconds(0);
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
    } finally { setIsLocating(false); }
  };

  useEffect(() => { setScannerSupported(typeof window !== "undefined" && "BarcodeDetector" in window); }, []);
  const inRange = distance !== null && Number.isFinite(distance) && distance <= targetRadius;
  const qrVerified = Boolean(qrInput.trim()) && (!settings.qrCode || qrInput.trim() === settings.qrCode.trim());
  const confirmationActive = Boolean(confirmationExpiresAt && remainingSeconds > 0 && inRange && qrVerified);

  // Start the one-minute confirmation window only after both GPS and QR are verified.
  // Editing the QR value creates a fresh verification window; letting it expire clears the QR.
  useEffect(() => {
    if (!inRange || !qrVerified || step !== "scan") {
      setConfirmationExpiresAt(null);
      setRemainingSeconds(0);
      return;
    }
    const expiresAt = Date.now() + CONFIRMATION_WINDOW_MS;
    setConfirmationExpiresAt(expiresAt);
    setRemainingSeconds(60);
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds <= 0) {
        window.clearInterval(timer);
        setConfirmationExpiresAt(null);
        setRemainingSeconds(0);
        setQrInput("");
        setError("انتهت مهلة تأكيد الحضور/الانصراف. أعد مسح رمز QR ثم أكّد العملية خلال دقيقة واحدة.");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [inRange, qrVerified, step]);

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
    if (!inRange) { setError(`أنت خارج نطاق العمل. المسافة الحالية: ${distance ?? "غير معروفة"} م (الحد المسموح: ${targetRadius} م)`); setStep("error"); return; }
    if (!confirmationActive) { setError("انتهت أو لم تبدأ مهلة التحقق. أعد مسح رمز QR وأكّد العملية خلال دقيقة واحدة."); return; }
    setError(null); setStep("submitting");
    void (async () => {
      const response = await recordAttendance({ jobNumber: session.jobNumber, type: action, position: pos, qrCode: qrInput.trim() });
      if (!response.ok) { setError(response.reason ?? "تعذر تسجيل العملية"); setStep("error"); return; }
      setConfirmationExpiresAt(null);
      setRemainingSeconds(0);
      setResult({ time: response.record!.timestamp, timeNote: response.timeNote }); setStep("success");
    })();
  };

  const title = action === "check-out" ? "تسجيل الانصراف" : "تسجيل الحضور";
  const statusText = step === "loading-location" ? "جاري تحميل موقع العمل" : isLocating ? "جاري تحديد موقعك..." : step === "error" ? "تعذر التحقق من الموقع" : step === "gps" ? "اضغط لتحديد موقعك" : inRange ? "تم التحقق من الموقع" : "خارج نطاق الموقع";
  const timerText = confirmationActive ? `00:${String(remainingSeconds).padStart(2, "0")}` : "--:--";
  const timerReadyText = confirmationActive ? "المتبقي" : inRange && qrInput.trim() ? "جاري التحقق" : "بانتظار GPS + QR";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-5 py-5 flex items-center justify-between"><Brand /><Link to="/employee" className="btn-ghost text-xs" onClick={stopCamera}>إلغاء</Link></header>
      <main className="max-w-xl mx-auto px-5 pb-16 space-y-5">
        <section className="hud-card p-6"><div className="text-xs text-muted-foreground mono">{action === "check-in" ? "CHECK IN" : "CHECK OUT"}</div><h1 className="text-2xl font-extrabold mt-0.5">{title}</h1><div className="text-sm text-muted-foreground mt-1">{session?.name ?? "الموظف"} · <span className="mono">{session?.jobNumber ?? "-"}</span> · <span className="text-primary font-semibold">{locationName}</span></div></section>
        <section className="hud-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold">١. التحقق من الموقع</div><StepBadge state={step === "loading-location" || step === "gps" || isLocating ? "active" : step === "error" ? "fail" : "done"} /></div>
          <GpsRadar />
          <div className="text-center mt-4"><div className="text-base font-extrabold radar-status">{statusText}</div><div className="text-xs text-muted-foreground mt-1">{step === "loading-location" ? "يتم تحميل موقع العمل من الخادم..." : isLocating ? "جاري استقبال بيانات الموقع من جهازك ومقارنتها بالموقع المسجل..." : step === "gps" || step === "error" ? "اضغط لتحديد موقعك ومقارنته بموقع العمل." : "تم تحديد موقع جهازك ومقارنته بنطاق العمل."}</div></div>
          <button type="button" onClick={() => void refreshGps()} disabled={isLocating || !location} className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2">{isLocating ? <><span className="animate-spin">⟳</span> جاري تحديد موقعي...</> : <>📍 تحديد موقعي الحالي</>}</button>
          <div className="grid grid-cols-2 gap-2 text-center mt-4 text-xs"><Cell label="المسافة الحالية" value={distance !== null ? `${Math.round(distance)} م` : "…"} /><Cell label="النطاق المسموح" value={Number.isFinite(targetRadius) ? `${Math.round(targetRadius)} م` : "…"} /><Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} /><Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} /></div>
          {distance !== null && !inRange && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive font-semibold">الموقع خارج النطاق؛ لن يتم السماح بتسجيل العملية.</div>}
        </section>
        <section className={`hud-card p-6 ${!inRange ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold">٢. مسح رمز QR</div><StepBadge state={qrInput ? "done" : step === "scan" && inRange ? "active" : "idle"} /></div>
          <div className="rounded-2xl border border-border/70 bg-background overflow-hidden text-center">
            {isCameraActive ? <div className="relative min-h-[72vh] sm:min-h-[580px] w-full bg-black overflow-hidden">
              <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-0 bg-black/25 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 text-white"><div><div className="text-sm font-bold">ماسح رمز QR</div><div className="text-[11px] text-white/70 mt-0.5">طابق الرمز مع الإطار الأخضر</div></div><button type="button" onClick={stopCamera} className="h-10 w-10 rounded-full bg-black/55 border border-white/20 grid place-items-center text-lg" aria-label="إغلاق الكاميرا">×</button></div>
              <div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="relative w-[76vw] max-w-[340px] aspect-square rounded-[28px] bg-black/10 shadow-[0_0_0_9999px_rgba(0,0,0,.30)]"><div className="absolute inset-0 rounded-[28px] border-[3px] border-primary shadow-[0_0_24px_hsl(var(--primary)/.35),inset_0_0_18px_hsl(var(--primary)/.08)]" /><div className="absolute inset-[9px] rounded-[20px] border border-white/20" /><div className="absolute left-[12%] right-[12%] top-1/2 h-px bg-primary shadow-[0_0_14px_hsl(var(--primary)/.95)] animate-pulse" /><div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary)/1)]" /></div></div>
              <div className="absolute inset-x-0 bottom-0 z-10 p-5"><div className="mx-auto max-w-sm rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 p-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" /><span className="text-xs text-white/90 flex-1 text-right">{scannerSupported ? "ضع رمز QR داخل الإطار وسيتم التعرف عليه تلقائيًا" : "الكاميرا تعمل، لكن المسح التلقائي غير مدعوم في هذا المتصفح"}</span>{torchSupported && <button type="button" onClick={() => void toggleTorch()} className={`h-10 w-10 shrink-0 rounded-xl border text-base ${torchOn ? "bg-white text-black border-white" : "bg-white/10 text-white border-white/20"}`} aria-label={torchOn ? "إطفاء الإضاءة" : "تشغيل الإضاءة"}>⌁</button>}</div><button type="button" onClick={stopCamera} className="mt-2 w-full max-w-sm mx-auto block rounded-xl bg-white/10 border border-white/20 text-white py-2.5 text-xs font-bold">إغلاق الماسح</button></div>
            </div> : <div className="p-6 sm:p-8"><div className="mx-auto h-20 w-20 rounded-2xl bg-secondary grid place-items-center mb-4 border border-border/60"><QrIcon /></div><p className="text-sm font-semibold">امسح رمز QR المخصص لـ{locationName}</p><p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1.5 leading-6">افتح الكاميرا ووجّه الرمز داخل الإطار الأخضر. سيتم التعرف عليه تلقائيًا.</p><div className="flex flex-col sm:flex-row justify-center gap-2 mt-5"><button type="button" onClick={() => void startCamera()} className="btn-primary text-xs shadow" disabled={step !== "scan" || !inRange}>📷 فتح ماسح QR</button><button type="button" onClick={() => setQrInput(settings.qrCode || "")} className="btn-secondary text-xs" disabled={step !== "scan" || !inRange || !settings.qrCode}>إدخال القيمة يدويًا</button></div></div>}
          </div>
          <div className="mt-4"><label className="block text-xs text-muted-foreground mb-1" htmlFor="qr-code">قيمة QR</label><input id="qr-code" className="input mono text-sm" placeholder="أدخل القيمة المطبوعة على QR" value={qrInput} onChange={(e) => setQrInput(e.target.value)} disabled={step !== "scan" || !inRange} autoComplete="off" /></div>
        </section>
        <section className="hud-card p-6">
          {step === "error" && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4"><div className="font-semibold text-destructive">فشل التحقق</div><div className="text-xs text-muted-foreground mt-1">{error}</div></div>}
          {step === "success" && result && <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm mb-4"><div className="font-extrabold text-primary text-lg">تمت العملية بنجاح</div><div className="text-xs text-muted-foreground mt-1">{title} في {formatTime(result.time)}{result.timeNote ? ` · ${result.timeNote}` : ""}</div></div>}
          <div className="flex gap-3 items-center"><button className="btn-primary flex-1 py-3" onClick={submit} disabled={step !== "scan" || !inRange || !qrInput.trim() || !pos || !confirmationActive}>{step === "submitting" ? "جاري التسجيل..." : `تأكيد ${title}`}</button><div className={`shrink-0 rounded-xl border px-3 py-2 text-center ${confirmationActive ? "border-primary/25 bg-secondary/50" : "border-border/60 bg-secondary/30"}`}><div className="text-[10px] text-muted-foreground">{timerReadyText}</div><div className={`mono font-black text-sm tabular-nums ${confirmationActive ? "text-primary" : "text-muted-foreground"}`}>{timerText}</div></div>{(step === "success" || step === "error") && <button onClick={() => { stopCamera(); nav("/employee"); }} className="btn-secondary">عودة</button>}</div>
        </section>
      </main>
    </div>
  );
}

function GpsRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 400, center = size / 2, radius = size / 2 - 20;
    let sweepAngle = 0, frame = 0, cancelled = false;
    const drawBase = () => {
      ctx.clearRect(0, 0, size, size); ctx.fillStyle = "#061013"; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(0,255,204,.20)"; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i += 1) { ctx.beginPath(); ctx.arc(center, center, (radius / 4) * i, 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeStyle = "rgba(0,255,204,.12)"; ctx.beginPath(); ctx.moveTo(center-radius,center); ctx.lineTo(center+radius,center); ctx.moveTo(center,center-radius); ctx.lineTo(center,center+radius); ctx.stroke();
      ctx.fillStyle = "rgba(0,255,204,.55)"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      [0,45,90,135,180,225,270,315].forEach((degree) => { const rad=(degree-90)*(Math.PI/180); ctx.fillText(`${degree}°`,center+(radius+12)*Math.cos(rad),center+(radius+12)*Math.sin(rad)+3); });
    };
    const drawTargets = (now:number) => {
      [{r:.40,angle:45},{r:.74,angle:160},{r:.56,angle:280}].forEach((target,index) => {
        const rad=(target.angle-90)*(Math.PI/180), x=center+radius*target.r*Math.cos(rad), y=center+radius*target.r*Math.sin(rad), pulse=.5+.5*Math.sin(now/260+index*1.7), targetRadius=3+pulse*2.5;
        ctx.beginPath(); ctx.arc(x,y,targetRadius+5+pulse*5,0,Math.PI*2); ctx.strokeStyle=`rgba(255,51,102,${.12+pulse*.18})`; ctx.lineWidth=1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(x,y,targetRadius,0,Math.PI*2); ctx.fillStyle="#ff3366"; ctx.shadowBlur=10+pulse*10; ctx.shadowColor="#ff3366"; ctx.fill(); ctx.shadowBlur=0;
      });
      const centerPulse=.5+.5*Math.sin(now/85), centerRadius=5+centerPulse*3;
      ctx.beginPath(); ctx.arc(center,center,centerRadius+6+centerPulse*7,0,Math.PI*2); ctx.strokeStyle=`rgba(255,51,102,${.16+centerPulse*.24})`; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.arc(center,center,centerRadius,0,Math.PI*2); ctx.fillStyle="#ff3366"; ctx.shadowBlur=14+centerPulse*16; ctx.shadowColor="#ff3366"; ctx.fill(); ctx.shadowBlur=0;
    };
    const drawSweep = () => {
      ctx.save(); ctx.translate(center,center); ctx.rotate(sweepAngle);
      const gradient=ctx.createConicGradient(-Math.PI/2,0,0); gradient.addColorStop(0,"rgba(0,255,204,.28)"); gradient.addColorStop(.15,"rgba(0,255,204,.03)"); gradient.addColorStop(1,"transparent"); ctx.fillStyle=gradient;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,radius,-Math.PI/2,Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-radius); ctx.strokeStyle="#00ffcc"; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    };
    const animate=(now:number)=>{ if(cancelled)return; drawBase(); drawTargets(now); drawSweep(); sweepAngle+=.025; if(sweepAngle>=Math.PI*2)sweepAngle=0; frame=window.requestAnimationFrame(animate); };
    frame=window.requestAnimationFrame(animate);
    return()=>{cancelled=true;window.cancelAnimationFrame(frame);};
  }, []);
  return <div className="mx-auto w-full max-w-[280px] aspect-square rounded-full border border-primary/25 bg-[#061013] overflow-hidden shadow-[0_0_40px_hsl(var(--primary)/.08)]"><canvas ref={canvasRef} width={400} height={400} className="block h-full w-full" aria-label="رادار تحديد الموقع GPS" /></div>;
}

function StepBadge({ state }: { state: "idle" | "active" | "done" | "fail" }) { const map = { idle: { c: "bg-secondary text-muted-foreground", t: "في الانتظار" }, active: { c: "bg-accent/15 text-accent animate-pulse", t: "جاري..." }, done: { c: "bg-primary/15 text-primary", t: "تم" }, fail: { c: "bg-destructive/15 text-destructive", t: "فشل" } } as const; const status = map[state]; return <span className={`badge ${status.c}`}>{status.t}</span>; }
function Cell({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/40 border border-border/50 p-2"><div className="text-[10px] text-muted-foreground mono">{label}</div><div className="font-semibold mono mt-0.5">{value}</div></div>; }
function QrIcon() { return <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2v2h-2z" /></svg>; }
