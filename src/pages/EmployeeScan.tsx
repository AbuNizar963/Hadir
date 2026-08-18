import { useEffect, useState } from "react";
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
    };
  }, [targetLat, targetLng, targetRadius, locationName]);

  const simulateScan = () => setQrInput(settings.qrCode);

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
        <Link to="/employee" className="btn-ghost text-xs">إلغاء</Link>
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

        {/* GPS card */}
        <section className="hud-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">١. التحقق من الموقع</div>
            <StepBadge state={step === "gps" ? "active" : distance !== null && distance <= targetRadius ? "done" : step === "error" && pos === null ? "fail" : "done"} />
          </div>
          <RadarView radius={targetRadius} distance={distance} state={step === "error" && (!pos || (distance ?? 0) > targetRadius) ? "out" : distance !== null ? "in" : "loading"} />
          <div className="grid grid-cols-3 gap-2 text-center mt-4 text-xs">
            <Cell label="خط العرض" value={pos ? pos.lat.toFixed(5) : "…"} />
            <Cell label="خط الطول" value={pos ? pos.lng.toFixed(5) : "…"} />
            <Cell label="المسافة" value={distance !== null ? `${distance} م` : "…"} />
          </div>
        </section>

        {/* QR card */}
        <section className={`hud-card p-6 ${step === "gps" ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold">٢. مسح رمز QR الثابت</div>
            <StepBadge state={qrInput ? "done" : step === "scan" ? "active" : "idle"} />
          </div>
          <div className="rounded-xl border border-dashed border-border/70 bg-secondary/30 p-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-2xl bg-background grid place-items-center mb-3 border border-border/60">
              <QrIcon />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-6">
              يمكنك مسح رمز QR الملصَق داخل {locationName}، أو إدخال قيمته يدويًا.
            </p>
            <button onClick={simulateScan} className="btn-secondary mt-4 text-xs" disabled={step !== "scan"}>
              محاكاة المسح
            </button>
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
              <button onClick={() => nav("/employee")} className="btn-secondary">
                عودة
              </button>
            ) : null}
            {step === "error" ? (
              <button onClick={() => nav("/employee")} className="btn-secondary">
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
    active: { c: "bg-accent/15 text-accent", t: "جارٍ..." },
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

function RadarView({
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
    <div className="relative aspect-square max-w-[220px] mx-auto">
      <div className="absolute inset-0 rounded-full border border-primary/30" />
      <div className="absolute inset-6 rounded-full border border-primary/25" />
      <div className="absolute inset-12 rounded-full border border-primary/20" />
      <div className="absolute inset-0 grid place-items-center">
        <div className={`h-3 w-3 rounded-full ${state === "out" ? "bg-destructive" : "bg-primary"} signal-ring`} />
      </div>
      {distance !== null && (
        <div
          className={`absolute h-2.5 w-2.5 rounded-full ${
            state === "out" ? "bg-destructive" : "bg-accent"
          } shadow-lg`}
          style={{
            top: `${50 - pct * 45}%`,
            left: `${50 + pct * 35}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center mt-16">
          <div className="mono text-[10px] text-muted-foreground">حالة الموقع</div>
          <div className={`font-extrabold text-sm mt-1 ${state === "out" ? "text-destructive" : state === "in" ? "text-primary" : "text-muted-foreground"}`}>
            {state === "loading" ? "جارٍ التحديد..." : state === "in" ? "داخل النطاق" : "خارج النطاق"}
          </div>
        </div>
      </div>
    </div>
  );
}
