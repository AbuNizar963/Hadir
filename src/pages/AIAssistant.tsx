import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import { getManagerSession } from "@/lib/storage";
import { getBackendAttendance, getBackendEmployeeProfile, backendEnabled } from "@/lib/backend";
import { answerEmployeeQuestion, answerManagerQuestion, employeeExamples, managerExamples, type AIAnswer, type AIContext } from "@/lib/localAI";
import { getPrayerTimes, qiblaBearing } from "@/lib/prayerTimes";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
type Msg = { role: "user" | "assistant"; text: string; items?: string[]; provider?: string };
const weatherLabel = (code: number) => code === 0 ? "صافي" : code <= 3 ? "غائم جزئيًا" : code <= 48 ? "ضباب" : code <= 67 ? "أمطار" : code <= 77 ? "ثلوج" : code <= 82 ? "زخات مطر" : code <= 86 ? "زخات ثلج" : "عاصفة";
function aiToken(manager: boolean) { if (typeof window === "undefined") return ""; return localStorage.getItem(manager ? "hadir.api.token.admin" : "hadir.api.token.employee") || ""; }
async function remoteAI(question: string, manager: boolean) {
  const token = aiToken(manager);
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}/api/ai`, { method: "POST", headers, credentials: "include", cache: "no-store", body: JSON.stringify({ question }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.text) throw new Error(String(data?.error || "تعذر تشغيل النموذج"));
  return { text: String(data.text), provider: String(data.provider || "cloudflare-workers-ai") };
}

export default function AIAssistant() {
  const nav = useNavigate();
  const employeeSession = currentSession();
  const managerSession = getManagerSession();
  const manager = Boolean(managerSession && !employeeSession);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [managerData, setManagerData] = useState<any>(null);
  const [context, setContext] = useState<AIContext>({});
  const [contextLoading, setContextLoading] = useState(true);
  const [provider, setProvider] = useState<string | null>(null);
  const examples = manager ? managerExamples : employeeExamples;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!backendEnabled) return;
        if (manager) {
          const token = aiToken(true);
          const r = await fetch(`${API_URL}/api/workforce/live`, { headers: token ? { authorization: `Bearer ${token}` } : {}, credentials: "include", cache: "no-store" });
          if (r.ok && alive) setManagerData(await r.json());
        } else {
          const [p, a] = await Promise.all([getBackendEmployeeProfile(), getBackendAttendance(5000)]);
          if (alive) { setEmployee(p); setAttendance(Array.isArray(a) ? a : []); }
        }
      } catch { /* AI remains available even when data synchronization fails. */ }
    })();
    return () => { alive = false; };
  }, [manager]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (!navigator.geolocation) { setContextLoading(false); return () => controller.abort(); }
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      try {
        const prayerPromise = getPrayerTimes({ latitude, longitude });
        const weatherPromise = fetch(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m", timezone: "auto" })}`, { cache: "no-store", signal: controller.signal }).then(r => r.ok ? r.json() : null);
        const geoPromise = fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`, { cache: "no-store", signal: controller.signal }).then(r => r.ok ? r.json() : null).catch(() => null);
        const [prayer, weather, geo] = await Promise.all([prayerPromise, weatherPromise, geoPromise]);
        if (!alive) return;
        const current = weather?.current;
        setContext({ city: geo?.city || geo?.locality || geo?.principalSubdivision || prayer.meta.city || "موقعك الحالي", prayer: prayer.times ? { ...prayer.times, gregorian: prayer.meta.gregorian, hijri: prayer.meta.hijri } : undefined, weather: current && typeof current.temperature_2m === "number" ? { temp: current.temperature_2m, apparent: current.apparent_temperature, wind: current.wind_speed_10m, description: weatherLabel(Number(current.weather_code)) } : undefined, qibla: qiblaBearing(latitude, longitude) });
      } catch { /* Location context is optional. */ }
      finally { if (alive) setContextLoading(false); }
    }, () => { if (alive) setContextLoading(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    return () => { alive = false; controller.abort(); };
  }, []);

  const intro = useMemo(() => manager ? `مرحبًا ${managerSession?.name || "مدير النظام"}. أنا Hadir AI، مساعدك الذكي لتحليل الحضور والغياب والهروب والإحصاءات.` : `مرحبًا ${employee?.name || employeeSession?.employeeId || ""}. أنا Hadir AI، مساعدك الذكي لبيانات حضورك والخدمات المحلية.`, [manager, managerSession?.name, employee?.name, employeeSession?.employeeId]);
  useEffect(() => setMessages([{ role: "assistant", text: intro }]), [intro]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    setMessages(m => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const answer = await remoteAI(text, manager);
      setProvider(answer.provider);
      setMessages(m => [...m, { role: "assistant", text: answer.text, provider: answer.provider }]);
    } catch {
      let a: AIAnswer;
      if (manager) {
        const d = managerData || { employees: [], attendance: [], escapes: [] };
        a = answerManagerQuestion(text, { employees: d.employees || [], attendance: d.attendance || [], escapes: d.escapes || [] }, context);
      } else if (employee) a = answerEmployeeQuestion(text, employee, attendance, context);
      else a = { text: "لم تكتمل مزامنة بياناتك بعد. حاول مرة أخرى بعد لحظات." };
      setProvider("local");
      setMessages(m => [...m, { role: "assistant", text: a.text, items: a.items, provider: "local" }]);
    } finally { setBusy(false); }
  };

  const providerLabel = provider === "google-gemini" ? "Gemini" : provider === "cloudflare-workers-ai" ? "Workers AI" : provider === "local" ? "محلي" : "جاهز";
  const statusText = provider === "google-gemini" ? "متصل عبر Gemini" : provider === "cloudflare-workers-ai" ? "متصل عبر Cloudflare Workers AI" : provider === "local" ? "وضع احتياطي محلي" : "جاهز للاتصال بالذكاء الاصطناعي";

  return <div dir="rtl" className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
        <button onClick={() => nav(-1)} className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:bg-secondary">← العودة</button>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><span className="text-sm font-black">AI</span></div>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-black sm:text-xl">Hadir AI</h1><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{providerLabel}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{statusText}</p></div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm lg:block">
          <div className="mb-4"><div className="text-xs font-bold text-primary">المساعد الشخصي</div><h2 className="mt-1 text-lg font-black">{manager ? "لوحة المدير" : "مساعدك"}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{manager ? "تحليل بيانات الموظفين ضمن الصلاحيات الممنوحة لك." : "معلومات حضورك وخدمات الموقع دون كشف بيانات الآخرين."}</p></div>
          <div className="space-y-2">{examples.slice(0, 8).map(x => <button key={x} onClick={() => ask(x)} disabled={busy} className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2.5 text-right text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50">{x}</button>)}</div>
          <div className="mt-5 rounded-2xl bg-secondary/60 p-3"><div className="text-[10px] font-bold text-muted-foreground">السياق المحلي</div><div className="mt-1 text-xs font-bold">{contextLoading ? "جارٍ تحديد الموقع…" : context.city || "الموقع غير متاح"}</div>{context.weather && <div className="mt-2 text-[11px] text-muted-foreground">{context.weather.temp}° · {context.weather.description}</div>}</div>
        </aside>

        <section className="flex min-h-[calc(100vh-130px)] flex-col overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-xl shadow-black/5 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black">{manager ? "مساعد المدير" : "مساعد الموظف"}</div><div className="mt-1 text-[11px] text-muted-foreground">اسأل بلغة طبيعية، وسأستخدم بيانات Hadir المسموح بها.</div></div><div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[10px] font-bold"><span className={`h-2 w-2 rounded-full ${provider === "local" ? "bg-amber-500" : "bg-emerald-500"}`} />{providerLabel}</div></div></div>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
            {messages.length === 1 && <div className="mx-auto mb-6 max-w-2xl rounded-3xl border border-primary/10 bg-primary/[0.035] p-5 text-center sm:p-7"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><span className="text-lg font-black">✦</span></div><h2 className="mt-4 text-xl font-black">كيف يمكنني مساعدتك؟</h2><p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-muted-foreground">تحدث معي بشكل طبيعي. يمكنك السؤال عن الحضور والغياب والهروب والإحصاءات، أو عن الطقس ومواقيت الصلاة والقبلة.</p></div>}
            {messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}><div className={`max-w-[92%] rounded-3xl px-4 py-3.5 sm:max-w-[78%] ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "border border-border/70 bg-secondary/60 rounded-bl-md"}`}><div className="mb-1 flex items-center gap-2 text-[10px] font-bold opacity-70">{m.role === "user" ? "أنت" : `Hadir AI${m.provider ? ` · ${m.provider === "google-gemini" ? "Gemini" : m.provider === "cloudflare-workers-ai" ? "Workers AI" : "محلي"}` : ""}`}</div><div className="whitespace-pre-wrap text-sm leading-7">{m.text}</div>{m.items && <ul className="mt-2 space-y-1 text-xs opacity-80">{m.items.map((x, j) => <li key={j}>• {x}</li>)}</ul>}</div></div>)}
            {busy && <div className="flex justify-end"><div className="rounded-3xl rounded-bl-md border border-border/70 bg-secondary/60 px-4 py-3 text-xs text-muted-foreground"><span className="animate-pulse">Hadir AI يفكر…</span></div></div>}
          </div>

          <div className="border-t border-border/70 bg-card/90 p-3 sm:p-4">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 lg:hidden">{examples.slice(0, 5).map(x => <button key={x} onClick={() => ask(x)} disabled={busy} className="shrink-0 rounded-full border border-border bg-secondary px-3 py-2 text-[11px] font-semibold disabled:opacity-50">{x}</button>)}</div>
            <form onSubmit={e => { e.preventDefault(); void ask(question); }} className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"><textarea value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); } }} rows={1} placeholder={manager ? "اسأل عن الموظفين والحضور…" : "اكتب سؤالك هنا…"} className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"/><button type="submit" disabled={!question.trim() || busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">↑</button></form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground"><span>Enter للإرسال · Shift+Enter لسطر جديد</span><span>{context.city ? `الموقع: ${context.city}` : "الموقع اختياري"}</span></div>
          </div>
        </section>
      </main>
    </div>
  </div>;
}