import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";
import { getManagerSession } from "@/lib/storage";
import { getBackendAttendance, getBackendEmployeeProfile, backendEnabled } from "@/lib/backend";
import { answerEmployeeQuestion, answerManagerQuestion, employeeExamples, managerExamples, type AIAnswer, type AIContext } from "@/lib/localAI";
import { getPrayerTimes, qiblaBearing } from "@/lib/prayerTimes";

const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
type Msg = { role: "user" | "assistant"; text: string; items?: string[] };
const weatherLabel = (code: number) => code === 0 ? "صافي" : code <= 3 ? "غائم جزئيًا" : code <= 48 ? "ضباب" : code <= 67 ? "أمطار" : code <= 77 ? "ثلوج" : code <= 82 ? "زخات مطر" : code <= 86 ? "زخات ثلج" : "عاصفة";

function aiToken(manager: boolean) {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(manager ? "hadir.api.token.admin" : "hadir.api.token.employee") || "";
}

async function remoteAI(question: string, manager: boolean) {
  const token = aiToken(manager);
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}/api/ai`, { method: "POST", headers, credentials: "include", cache: "no-store", body: JSON.stringify({ question }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.text) throw new Error(String(data?.error || "تعذر تشغيل النموذج"));
  return String(data.text);
}

function Icon({ children }: { children: ReactNode }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{children}</span>;
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
  const [aiMode, setAiMode] = useState<"cloud" | "local" | null>(null);
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
      } catch { /* يبقى المساعد متاحًا حتى عند تعذر المزامنة */ }
    })();
    return () => { alive = false; };
  }, [manager]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const loadContext = async () => {
      if (!navigator.geolocation) { setContextLoading(false); return; }
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
        } catch { /* السياق الإضافي اختياري */ }
        finally { if (alive) setContextLoading(false); }
      }, () => { if (alive) setContextLoading(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    };
    void loadContext();
    return () => { alive = false; controller.abort(); };
  }, []);

  const intro = useMemo(() => manager
    ? `مرحبًا ${managerSession?.name || "مدير النظام"}. أنا مساعد Hadir الذكي، جاهز لمساعدتك.`
    : `مرحبًا ${employee?.name || employeeSession?.employeeId || ""}. أنا مساعد Hadir الذكي، جاهز لمساعدتك.`,
    [manager, managerSession?.name, employee?.name, employeeSession?.employeeId]);

  useEffect(() => setMessages([{ role: "assistant", text: intro }]), [intro]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    setMessages(m => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const normalized = text.toLocaleLowerCase("ar").replace(/[؟?!.,،]/g, "").trim();
      const greetings = /^(مرحبا|مرحباً|مرحبًا|اهلا|أهلا|أهلًا|السلام عليكم|السلامعليكم|صباح الخير|مساء الخير|هاي|هلا|hello|hi)$/i;
      if (greetings.test(normalized)) {
        const greeting = normalized.includes("صباح") ? "صباح النور ☀️ كيف يمكنني مساعدتك اليوم؟" : normalized.includes("مساء") ? "مساء النور 🌙 كيف يمكنني مساعدتك؟" : "أهلًا وسهلًا 👋 أنا هنا لمساعدتك في Hadir. ماذا تريد أن تعرف؟";
        setAiMode("local");
        setMessages(m => [...m, { role: "assistant", text: greeting }]);
        return;
      }
      const answer = await remoteAI(text, manager);
      setAiMode("cloud");
      setMessages(m => [...m, { role: "assistant", text: answer }]);
    } catch {
      let a: AIAnswer;
      if (manager) {
        const d = managerData || { employees: [], attendance: [], escapes: [] };
        a = answerManagerQuestion(text, { employees: d.employees || [], attendance: d.attendance || [], escapes: d.escapes || [] }, context);
      } else if (employee) a = answerEmployeeQuestion(text, employee, attendance, context);
      else a = { text: "لم تكتمل مزامنة بياناتك بعد. حاول مرة أخرى بعد لحظات." };
      setAiMode("local");
      setMessages(m => [...m, { role: "assistant", text: a.text, items: a.items }]);
    } finally { setBusy(false); }
  };

  const clearChat = () => setMessages([{ role: "assistant", text: intro }]);

  return <div dir="rtl" className="min-h-screen bg-background text-foreground">
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button onClick={() => nav(-1)} className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold shadow-sm transition hover:bg-secondary">← العودة</button>
        <div className="text-right">
          <div className="mb-1 flex items-center justify-end gap-2 text-xs font-bold text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Hadir AI</div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">المساعد الذكي</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">مساعد مؤسسي ذكي لفهم الحضور والغياب والهروب والإحصاءات، مع خدمات الطقس ومواقيت الصلاة والقبلة.</p>
        </div>
      </header>

      <main className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
          <div className="flex items-center gap-3">
            <Icon><span className="text-sm font-black">AI</span></Icon>
            <div><div className="text-sm font-black">{manager ? "مساعد المدير" : "مساعد الموظف"}</div><div className="text-[11px] text-muted-foreground">{aiMode === "cloud" ? "متصل · Workers AI" : "متاح · الوضع الآمن"}</div></div>
          </div>
          <div className="mt-5 rounded-xl bg-secondary/60 p-3 text-xs leading-6 text-muted-foreground">{manager ? "يمكنني تحليل البيانات التي يملك المدير صلاحية الوصول إليها." : "خصوصيتك أولًا: أستطيع تحليل بيانات حضورك أنت فقط."}</div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-border p-3"><span>حالة المساعد</span><b className="text-primary">متاح</b></div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3"><span>السياق المحلي</span><b>{contextLoading ? "جارٍ" : context.city ? "متصل" : "غير متاح"}</b></div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-gradient-to-l from-primary/10 via-background to-background p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Icon><span className="text-base font-black">✦</span></Icon>
              <div className="min-w-0 flex-1"><div className="font-black">مرحبًا بك في Hadir AI</div><div className="mt-0.5 text-[11px] text-muted-foreground">اسأل بلغة طبيعية، وسأحاول إعطاؤك إجابة واضحة ومباشرة.</div></div>
              <button type="button" onClick={clearChat} className="rounded-lg border border-border px-3 py-2 text-[11px] font-bold hover:bg-secondary">محادثة جديدة</button>
            </div>
          </div>

          <div className="border-b border-border px-4 py-3 sm:px-5">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black">اقتراحات سريعة</span><span className="text-[10px] text-muted-foreground">اضغط لبدء السؤال</span></div>
            <div className="flex gap-2 overflow-x-auto pb-1">{examples.map(x => <button key={x} onClick={() => void ask(x)} className="shrink-0 rounded-full border border-border bg-secondary/40 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary">{x}</button>)}</div>
          </div>

          <div className="flex items-center gap-2 px-4 pt-3 text-[10px] text-muted-foreground sm:px-5"><span className={`h-1.5 w-1.5 rounded-full ${contextLoading ? "animate-pulse bg-muted-foreground" : "bg-primary"}`} />{contextLoading ? "جاري مزامنة السياق المحلي…" : context.city ? `السياق المحلي: ${context.city}` : "السياق المحلي غير متاح"}</div>

          <div className="min-h-[42vh] max-h-[56vh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
            {messages.map((m, i) => <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-secondary/55"}`}>
                <div className="mb-1 text-[10px] font-bold opacity-70">{m.role === "user" ? "أنت" : "Hadir AI"}</div>
                <div className="whitespace-pre-wrap text-sm leading-7">{m.text}</div>
                {m.items && <ul className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">{m.items.map((x, j) => <li key={j}>• {x}</li>)}</ul>}
              </div>
            </div>)}
            {busy && <div className="flex justify-end"><div className="rounded-2xl rounded-bl-md border border-border bg-secondary/55 px-4 py-3 text-xs text-muted-foreground"><span className="animate-pulse">يفكر المساعد…</span></div></div>}
          </div>

          <form onSubmit={e => { e.preventDefault(); void ask(question); }} className="border-t border-border bg-background/80 p-3 sm:p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
              <input value={question} onChange={e => setQuestion(e.target.value)} disabled={busy} placeholder={manager ? "اسأل عن الموظفين أو الحضور أو الطقس…" : "اسأل عن حضورك أو الطقس أو الصلاة…"} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" aria-label="رسالة المساعد الذكي" />
              <button disabled={!question.trim() || busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">إرسال</button>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground"><span>البيانات تخضع لصلاحيات حسابك.</span><span>{aiMode === "cloud" ? "● Workers AI" : "● مساعد آمن"}</span></div>
          </form>
        </section>
      </main>
    </div>
  </div>;
}
