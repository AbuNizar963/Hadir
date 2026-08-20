import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Brand from "@/components/Brand";
import { currentSession } from "@/lib/auth";
import { getCurrentPosition, haversineMeters, type GeoPosition } from "@/lib/geo";
import { findEmployeeByJobNumber, getSettings } from "@/lib/storage";
import { recordAttendance } from "@/lib/attendance";
import { formatTime } from "@/lib/utils";
import type { Settings } from "@/types";

type Step = "gps" | "scan" | "submitting" | "success" | "error";
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
declare global { interface Window { BarcodeDetector?: BarcodeDetectorConstructor } }

export default function EmployeeScan() {
  const { type } = useParams<{ type: "check-in" | "check-out" }>();
  const nav = useNavigate();
  const session = currentSession();
  const emp = session ? findEmployeeByJobNumber(session.jobNumber) : undefined;
  const action = type === "check-out" ? "check-out" : "check-in";
  const [settings] = useState<Settings>(() => getSettings());
  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("gps");
  const [error, setError] = useState<string | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<{ time: string; timeNote?: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  const assignedLocation = settings.locations?.find((location) => location.id === emp?.locationId);
  const targetLat = Number(assignedLocation?.lat ?? settings.workSiteLat);
  const targetLng = Number(assignedLocation?.lng ?? settings.workSiteLng);
  const targetRadius = Number(assignedLocation?.radiusMeters ?? settings.radiusMeters);
  const locationName = assignedLocation?.name ?? "المقر الرئيسي";

  const stopCamera = () => {
    scanningRef.current = false;
    if (scanTimerRef.current !== null) { window.clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsCameraActive(false);
  };

  useEffect(() => {
    setScannerSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
    let cancelled = false;
    (async () => {
      try {
        const position = await getCurrentPosition();
        if (cancelled) return;
        const currentDistance = haversineMeters(position, { lat: targetLat, lng: targetLng });
        setPos(position);
        setDistance(currentDistance);
        if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng) || !Number.isFinite(targetRadius)) {
          setError("إعدادات موقع العمل غير صالحة. يرجى مراجعة إعدادات GPS في لوحة الإدارة.");
          setStep("error");
          return;
        }
        // The local radius may be stale. Do not block here; recordAttendance performs the final check.
        setStep("scan");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "تعذر الحصول على الموقع");
        setStep("error");
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [targetLat, targetLng, targetRadius]);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError("هذا المتصفح لا يدعم الكاميرا. يمكنك إدخال قيمة QR يدويًا."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const Detector = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
      if (!Detector) { setScannerSupported(false); return; }
      setScannerSupported(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanningRef.current = true;
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes.find((code) => code.rawValue)?.rawValue?.trim();
          if (value) { setQrInput(value); stopCamera(); return; }
        } catch { /* continue */ }
        if (scanningRef.current) scanTimerRef.current = window.setTimeout(() => void scan(), 250);
      };
      void scan();
    } catch (e) {
      console.error("تعذر فتح الكاميرا:", e);
      setError("تعذر فتح الكاميرا. تأكد من منح صلاحية الكاميرا، أو أدخل قيمة QR يدويًا.");
      stopCamera();
    }
  };

  const submit = () => {
    if (!pos || !session || !qrInput.trim()) return;
    setError(null); setStep("submitting");
    void (async () => {
      const response = await recordAttendance({ jobNumber: session.jobNumber, type: action, position: pos, qrCode: qrInput.trim() });
      if (!response.ok) { setError(response.reason ?? "تعذر تسجيل العملية"); setStep("error"); return; }
      setResult({ time: response.record!.timestamp, timeNote: response.timeNote });
      setStep("success");
    })();
  };

  const title = action === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-5 py-5 flex items-center justify-between"><Brand /><Link to="/employee" className="btn-ghost text-xs" onClick={stopCamera}>إلغاء</Link></header>
      <main className="max-w-xl mx-auto px-5 pb-16 space-y-5">
        <section className="hud-card p-6"><div className="text-xs text-muted-foreground mono">ACTION</div><h1 className="text-2xl font-extrabold mt-0.5">{title}</h1><div className="text-sm text-muted-foreground mt-1">{session?.name ?? "الموظف"} · <span className="mono">{session?.jobNumber ?? "-"}</span> · <span className="text-primary font-semibold">{locationName}</span></div></section>

        <section className="hud-card p-6">
          <div className="flex items-center justify-between mb-2"><div className="text-sm font-bold">١. التحقق من الموقع</div><StepBadge state={step === "gps" ? "active" : step === "error" ? "fail" : "done"} /></div>
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-center">
            <div className="text-xs text-muted-foreground">المسافة الحالية</div>
            <div className="text-3xl font-extrabold mono mt-1">{distance !== null ? `${distance} م` : "…"}</div>
            <div className="text-xs text-muted-foreground mt-2">النطاق المحفوظ على هذا الجهاز: <span className="font-bold">{Number.isFinite(targetRadius) ? `${targetRadius} م` : "…"}</span></div>
            <div className="text-[10px] text-muted-foreground mt-1">التحقق النهائي من صلاحية النطاق يتم داخل مسار تسجيل الحضور.</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-4 text-xs"><Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} /><Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} /><Cell label="المسافة" value={distance !== null ? `${distance} م` : "…"} /></div>
        </section>

        <section className={`hud-card p-6 ${step === "gps" ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold">٢. مسح رمز QR</div><StepBadge state={qrInput ? "done" : step === "scan" ? "active" : "idle"} /></div>
          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 p-6 text-center overflow-hidden">
            {isCameraActive ? <div className="relative mx-auto h-56 w-full max-w-xs rounded-xl overflow-hidden bg-black border border-primary/50"><video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline /><div className="absolute inset-0 grid place-items-center pointer-events-none"><div className="h-32 w-32 border-2 border-dashed border-white/90 rounded-xl" /></div><div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2"><span className="px-3 py-1.5 bg-black/70 text-white text-[11px] rounded-full">{scannerSupported ? "وجّه الكاميرا نحو QR" : "المسح التلقائي غير مدعوم"}</span><button type="button" onClick={stopCamera} className="px-3 py-1.5 bg-destructive text-white text-xs font-bold rounded-full">إغلاق</button></div></div> : <><div className="mx-auto h-24 w-24 rounded-2xl bg-background grid place-items-center mb-3 border border-border/60 shadow-inner"><QrIcon /></div><p className="text-xs text-muted-foreground max-w-xs mx-auto leading-6">امسح رمز QR المخصص لـ{locationName}.</p><div className="flex justify-center gap-2 mt-4"><button type="button" onClick={() => void startCamera()} className="btn-primary text-xs shadow" disabled={step !== "scan"}>📷 فتح الكاميرا</button><button type="button" onClick={() => setQrInput(settings.qrCode || "")} className="btn-secondary text-xs" disabled={step !== "scan" || !settings.qrCode}>إدخال القيمة يدويًا</button></div></>}
          </div>
          <div className="mt-4"><label className="block text-xs text-muted-foreground mb-1" htmlFor="qr-code">قيمة QR</label><input id="qr-code" className="input mono text-sm" placeholder="أدخل القيمة المطبوعة على QR" value={qrInput} onChange={(e) => setQrInput(e.target.value)} disabled={step === "gps" || step === "submitting"} autoComplete="off" /></div>
        </section>

        <section className="hud-card p-6">
          {step === "error" && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm mb-4"><div className="font-semibold text-destructive">فشل التحقق</div><div className="text-xs text-muted-foreground mt-1">{error}</div></div>}
          {step === "success" && result && <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm mb-4"><div className="font-extrabold text-primary text-lg">تمت العملية بنجاح</div><div className="text-xs text-muted-foreground mt-1">{title} في {formatTime(result.time)}{result.timeNote ? ` · ${result.timeNote}` : ""}</div></div>}
          <div className="flex gap-3"><button className="btn-primary flex-1 py-3" onClick={submit} disabled={step !== "scan" || !qrInput.trim() || !pos}>{step === "submitting" ? "جاري التسجيل..." : `تأكيد ${title}`}</button>{(step === "success" || step === "error") && <button onClick={() => { stopCamera(); nav("/employee"); }} className="btn-secondary">عودة</button>}</div>
        </section>
      </main>
    </div>
  );
}

function StepBadge({ state }: { state: "idle" | "active" | "done" | "fail" }) { const map = { idle: { c: "bg-secondary text-muted-foreground", t: "في الانتظار" }, active: { c: "bg-accent/15 text-accent animate-pulse", t: "جارٍ..." }, done: { c: "bg-primary/15 text-primary", t: "تم" }, fail: { c: "bg-destructive/15 text-destructive", t: "فشل" } } as const; const status = map[state]; return <span className={`badge ${status.c}`}>{status.t}</span>; }
function Cell({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/40 border border-border/50 p-2"><div className="text-[10px] text-muted-foreground mono">{label}</div><div className="font-semibold mono mt-0.5">{value}</div></div>; }
function QrIcon() { return <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2v2h-2z" /></svg>; }
