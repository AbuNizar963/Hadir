import { useState, type ReactNode } from "react";
import { currentManager } from "@/lib/auth";
import { bulkOwnerEmployeeSettings } from "@/lib/ownerBulkSettings";

function Icon({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

const controls = [
  { id: "password", title: "تغيير كلمة مرور جميع الموظفين", description: "تطبيق كلمة مرور جديدة على جميع حسابات الموظفين وإلغاء جلساتهم الحالية.", icon: <Icon><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M12 15v3"/></Icon> },
  { id: "avatar", title: "تغيير الصورة الشخصية للجميع", description: "رفع صورة موحدة وحفظها في R2 لكل موظف.", icon: <Icon><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M19 5l2 2-2 2"/></Icon> },
  { id: "grace", title: "مهلة التأخر", description: "تحديد عدد الدقائق المسموح بها قبل احتساب التأخر لجميع الموظفين.", icon: <Icon><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></Icon> },
  { id: "earlyCheckout", title: "مهلة الانصراف المبكر", description: "السماح بالانصراف قبل نهاية الدوام ضمن عدد الدقائق المحدد.", icon: <Icon><path d="M7 7h10v14H7z"/><path d="M9 3h6v4H9z"/><path d="M10 12h4M12 10v4"/></Icon> },
  { id: "workHours", title: "أوقات دوام جميع الموظفين", description: "تطبيق وقت بداية ونهاية موحدين على جميع الموظفين دون تغيير نوع دوامهم أو أيامهم.", icon: <Icon><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M5 4 3 6M19 4l2 2"/></Icon> },
  { id: "rotationDays", title: "أيام التناوب للموظفين التناوبيين", description: "تطبيق عدد أيام المناوبة وأيام الراحة على الموظفين من نوع الدوام التناوبي فقط.", icon: <Icon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></Icon> },
  { id: "unlinkDevices", title: "فك ربط جميع الأجهزة", description: "إزالة ربط الهاتف ومفاتيح الدخول لجميع الموظفين ليتمكنوا من ربط أجهزة جديدة.", icon: <Icon><path d="M9 7l6 6"/><path d="M15 7l-2-2a3 3 0 0 0-4 4l2 2"/><path d="M9 17l2 2a3 3 0 0 0 4-4l-2-2"/><path d="M4 4l16 16"/></Icon> },
  { id: "revokeSessions", title: "تسجيل خروج جميع الموظفين", description: "إلغاء جميع جلسات الموظفين الحالية وإجبارهم على تسجيل الدخول من جديد.", icon: <Icon><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></Icon> },
] as const;

type Action = typeof controls[number]["id"];

export default function OwnerBulkSettingsPanel() {
  const manager = currentManager();
  const isOwner = manager?.role === "owner" || manager?.accountId === "bootstrap";
  const [selected, setSelected] = useState<Action | "">("");
  const [password, setPassword] = useState("");
  const [grace, setGrace] = useState("10");
  const [earlyCheckout, setEarlyCheckout] = useState("0");
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [rotationDaysOn, setRotationDaysOn] = useState("4");
  const [rotationDaysOff, setRotationDaysOff] = useState("4");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!isOwner) return null;
  const control = controls.find(item => item.id === selected);

  const run = async () => {
    if (!selected) return;
    setMessage("");
    try {
      setBusy(true);
      if (selected === "password") {
        if (password.length < 6) throw new Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
        const result = await bulkOwnerEmployeeSettings({ action: selected, password });
        setMessage(`تم تغيير كلمة مرور ${result.updated} موظفًا بنجاح.`); setPassword("");
      } else if (selected === "grace" || selected === "earlyCheckout") {
        const minutes = Number(selected === "grace" ? grace : earlyCheckout);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 180) throw new Error("القيمة يجب أن تكون بين 0 و180 دقيقة.");
        const result = await bulkOwnerEmployeeSettings({ action: selected, minutes });
        setMessage(selected === "grace" ? `تم ضبط مهلة التأخر لـ ${result.updated} موظفًا إلى ${minutes} دقيقة.` : `تم ضبط مهلة الانصراف المبكر إلى ${minutes} دقيقة.`);
      } else if (selected === "workHours") {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(workStartTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(workEndTime)) throw new Error("أدخل وقت البداية والنهاية بصيغة HH:MM صحيحة.");
        if (workStartTime === workEndTime) throw new Error("وقت البداية والنهاية يجب أن يكونا مختلفين.");
        const result = await bulkOwnerEmployeeSettings({ action: selected, workStartTime, workEndTime });
        setMessage(`تم تحديث أوقات الدوام لـ ${result.updated} موظفًا: ${workStartTime} → ${workEndTime}.`);
      } else if (selected === "rotationDays") {
        const daysOn = Number(rotationDaysOn), daysOff = Number(rotationDaysOff);
        if (!Number.isInteger(daysOn) || daysOn < 1 || daysOn > 31 || !Number.isInteger(daysOff) || daysOff < 0 || daysOff > 31) throw new Error("أيام التناوب يجب أن تكون: المناوبة 1–31 يومًا، والراحة 0–31 يومًا.");
        if (daysOn + daysOff < 2) throw new Error("يجب أن تحتوي دورة التناوب على يومين على الأقل.");
        const result = await bulkOwnerEmployeeSettings({ action: selected, rotationDaysOn: daysOn, rotationDaysOff: daysOff });
        setMessage(`تم تحديث دورة التناوب لـ ${result.updated} موظفًا تناوبيًا: ${daysOn} أيام مناوبة + ${daysOff} أيام راحة.`);
      } else if (selected === "avatar") {
        if (!image) throw new Error("اختر صورة أولًا.");
        if (!image.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة.");
        if (image.size > 10 * 1024 * 1024) throw new Error("حجم الصورة الأصلية يجب ألا يتجاوز 10 ميغابايت.");
        const result = await bulkOwnerEmployeeSettings({ action: selected, file: image });
        setMessage(`تم تحديث صورة ${result.updated} موظفًا بنجاح.`); setImage(null);
      } else {
        if (!window.confirm(selected === "unlinkDevices" ? "سيتم فك ربط جميع أجهزة الموظفين. هل تريد المتابعة؟" : "سيتم تسجيل خروج جميع الموظفين من الجلسات الحالية. هل تريد المتابعة؟")) return;
        const result = await bulkOwnerEmployeeSettings({ action: selected });
        setMessage(selected === "unlinkDevices" ? `تم فك ربط ${result.updated} موظفًا بنجاح.` : `تم تسجيل خروج ${result.updated} موظفًا.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تنفيذ العملية."); }
    finally { setBusy(false); }
  };

  return <section dir="rtl" className="hud-card p-5 sm:p-6 border-primary/30 bg-primary/5">
    <div className="text-xs mono text-primary font-bold mb-1">OWNER CONTROL · BULK EMPLOYEE SETTINGS</div>
    <h2 className="text-lg font-bold mb-1">إدارة الموظفين دفعة واحدة</h2>
    <p className="text-sm text-muted-foreground mb-5">مركز تحكم موحد للمالك، مع قوائم منسدلة لتجميع العمليات وتقليل الازدحام ومنع التغييرات غير المقصودة.</p>

    <div className="rounded-2xl border bg-background/70 p-3 sm:p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="rounded-xl p-2 text-primary bg-primary/10">{control?.icon || <Icon><path d="M4 6h16M4 12h16M4 18h16"/><path d="m8 9 2 2 4-4"/></Icon>}</span>
        <div className="min-w-0 flex-1"><div className="font-bold">اختيار إعداد</div><div className="text-xs text-muted-foreground">اختر العملية المطلوبة من القائمة</div></div>
      </div>
      <div className="relative">
        <select className="input w-full appearance-none pr-4 pl-10 font-medium" value={selected} onChange={e => { setSelected(e.target.value as Action | ""); setMessage(""); }}>
          <option value="">اختر إعدادًا من القائمة…</option>
          <optgroup label="حسابات وملفات الموظفين">
            <option value="password">تغيير كلمة مرور جميع الموظفين</option>
            <option value="avatar">تغيير الصورة الشخصية للجميع</option>
          </optgroup>
          <optgroup label="الدوام والحضور">
            <option value="grace">مهلة التأخر</option>
            <option value="earlyCheckout">مهلة الانصراف المبكر</option>
            <option value="workHours">أوقات دوام جميع الموظفين</option>
            <option value="rotationDays">أيام التناوب للموظفين التناوبيين</option>
          </optgroup>
          <optgroup label="الأجهزة والجلسات">
            <option value="unlinkDevices">فك ربط جميع الأجهزة</option>
            <option value="revokeSessions">تسجيل خروج جميع الموظفين</option>
          </optgroup>
        </select>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>

    {control && <div className="mt-3 rounded-2xl border bg-background/60 overflow-hidden">
      <div className="flex items-start gap-3 p-4 border-b">
        <span className="rounded-xl p-2 text-primary bg-primary/10">{control.icon}</span>
        <div><div className="font-bold">{control.title}</div><div className="text-xs text-muted-foreground mt-1">{control.description}</div></div>
      </div>
      <div className="p-4 bg-muted/10">
        {selected === "password" && <div className="flex flex-col sm:flex-row gap-2"><input type="password" className="input flex-1" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة مرور جديدة" /><button type="button" className="btn-primary whitespace-nowrap" disabled={busy} onClick={() => void run()}>{busy ? "جارٍ…" : "تطبيق على الجميع"}</button></div>}
        {selected === "avatar" && <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"><input type="file" accept="image/*" className="input text-xs flex-1" onChange={e => setImage(e.target.files?.[0] || null)} /><button type="button" className="btn-primary whitespace-nowrap" disabled={busy || !image} onClick={() => void run()}>{busy ? "جارٍ…" : "رفع وتطبيق"}</button></div>}
        {(selected === "grace" || selected === "earlyCheckout") && <div className="flex flex-col sm:flex-row gap-2 sm:items-center"><select className="input mono sm:max-w-[220px]" value={selected === "grace" ? grace : earlyCheckout} onChange={e => selected === "grace" ? setGrace(e.target.value) : setEarlyCheckout(e.target.value)}>{[0,5,10,15,20,30,45,60,90,120,180].map(value => <option key={value} value={value}>{value} دقيقة</option>)}</select><button type="button" className="btn-primary whitespace-nowrap sm:mr-auto" disabled={busy} onClick={() => void run()}>{busy ? "جارٍ…" : "حفظ وتطبيق"}</button></div>}
        {selected === "workHours" && <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end"><label className="text-sm">بداية الدوام<input type="time" className="input mono mt-1 w-full" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} /></label><label className="text-sm">نهاية الدوام<input type="time" className="input mono mt-1 w-full" value={workEndTime} onChange={e => setWorkEndTime(e.target.value)} /></label><button type="button" className="btn-primary whitespace-nowrap" disabled={busy} onClick={() => void run()}>{busy ? "جارٍ…" : "حفظ وتطبيق"}</button></div>}
        {selected === "rotationDays" && <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end"><label className="text-sm">أيام المناوبة<select className="input mono mt-1 w-full" value={rotationDaysOn} onChange={e => setRotationDaysOn(e.target.value)}>{Array.from({length:31},(_,i)=>i+1).map(value => <option key={value} value={value}>{value} يوم</option>)}</select></label><label className="text-sm">أيام الراحة<select className="input mono mt-1 w-full" value={rotationDaysOff} onChange={e => setRotationDaysOff(e.target.value)}>{Array.from({length:32},(_,i)=>i).map(value => <option key={value} value={value}>{value} يوم</option>)}</select></label><button type="button" className="btn-primary whitespace-nowrap" disabled={busy} onClick={() => void run()}>{busy ? "جارٍ…" : "حفظ وتطبيق"}</button></div>}
        {(selected === "unlinkDevices" || selected === "revokeSessions") && <div className="flex flex-col sm:flex-row gap-3 sm:items-center"><span className="text-sm text-muted-foreground flex-1">{selected === "unlinkDevices" ? "سيتم إلغاء ربط الهاتف ومفتاح الدخول لكل موظف مع إبقاء الحسابات والبيانات الوظيفية محفوظة." : "سيتم إبطال الجلسات الحالية فقط؛ لن تتغير كلمات المرور أو البيانات."}</span><button type="button" className="btn-danger whitespace-nowrap" disabled={busy} onClick={() => void run()}>{busy ? "جارٍ…" : "تأكيد التنفيذ"}</button></div>}
      </div>
    </div>}
    {message && <div role="status" className="mt-4 rounded-xl border p-3 text-sm bg-background/70">{message}</div>}
  </section>;
}
