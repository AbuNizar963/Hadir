import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/storage";
import { hash } from "@/lib/hash";
import { backendEnabled, createBackendAdmin, deleteBackendAdmin, getBackendAdmins, getBackendSettings, saveBackendSettings, updateBackendAdmin } from "@/lib/backend";
import type { AdminAccount, Settings } from "@/types";

function Chevron() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AdminIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="M12 3l7 3v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M9 11.5a3 3 0 1 1 6 0M8.5 17c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

function AttendancePolicyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/><path d="M4.5 5.5 3 4M19.5 5.5 21 4"/></svg>;
}

export default function AdminAccountsPanel() {
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [remoteAccounts, setRemoteAccounts] = useState<Array<{id:string;username:string;name:string;role:"owner"|"manager"|"supervisor";active:boolean;createdAt:string}>>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "supervisor">("manager");
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [generatingRecovery, setGeneratingRecovery] = useState(false);
  const [savingAttendancePolicy, setSavingAttendancePolicy] = useState(false);
  const [attendancePolicyMessage, setAttendancePolicyMessage] = useState("");

  const loadRemote = async () => {
    if (!backendEnabled) return;
    try {
      setRemoteAccounts(await getBackendAdmins());
      const remote = await getBackendSettings();
      if (remote) setSettings(prev => ({ ...prev, ...remote } as Settings));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر تحميل الحسابات من الخادم");
    }
  };

  useEffect(() => { void loadRemote(); }, []);

  const accounts = (settings.adminAccounts || []).filter(a => a.role !== "owner");

  const saveLocal = (nextAccounts: AdminAccount[]) => {
    const next = { ...settings, adminAccounts: [...(settings.adminAccounts || []).filter(a => a.role === "owner"), ...nextAccounts] };
    setSettings(next);
    saveSettings(next);
  };

  const addAccount = async () => {
    const cleanName = name.trim();
    const cleanUsername = username.trim();
    if (!cleanName || !cleanUsername || password.length < 12) {
      setMessage("أدخل الاسم واسم المستخدم وكلمة مرور من 12 محرفًا على الأقل.");
      return;
    }

    setMessage(backendEnabled ? "جاري إنشاء الحساب على الخادم..." : "");
    try {
      if (backendEnabled) {
        await createBackendAdmin({ name: cleanName, username: cleanUsername, password, role });
        await loadRemote();
      } else {
        if ((settings.adminAccounts || []).some(a => a.username.toLowerCase() === cleanUsername.toLowerCase())) {
          setMessage("اسم المستخدم مستخدم مسبقًا.");
          return;
        }
        const account: AdminAccount = {
          id: `admin_${Date.now()}`,
          username: cleanUsername,
          passwordHash: hash(password),
          name: cleanName,
          role,
          active: true,
          createdAt: new Date().toISOString(),
        };
        saveLocal([...accounts, account]);
      }
      setName("");
      setUsername("");
      setPassword("");
      setMessage("تمت إضافة الحساب بنجاح.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر إنشاء الحساب");
    }
  };

  const toggle = async (id: string, active: boolean) => {
    try {
      if (backendEnabled) {
        await updateBackendAdmin(id, { active: !active });
        await loadRemote();
      } else {
        saveLocal(accounts.map(a => a.id === id ? { ...a, active: !a.active } : a));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر تعديل الحساب");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الحساب الإداري؟")) return;
    try {
      if (backendEnabled) {
        await deleteBackendAdmin(id);
        await loadRemote();
      } else {
        saveLocal(accounts.filter(a => a.id !== id));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر حذف الحساب");
    }
  };

  const displayAccounts = backendEnabled ? remoteAccounts.filter(a => a.role !== "owner") : accounts;
  const owner = backendEnabled ? remoteAccounts.find(a => a.role === "owner") : null;

  const saveAttendancePolicy = async () => {
    if (savingAttendancePolicy) return;
    const next: Settings = {
      ...settings,
      allowEarlyCheckIn: Boolean(settings.allowEarlyCheckIn),
      earlyCheckInGraceMinutes: Math.min(180, Math.max(0, Math.floor(Number(settings.earlyCheckInGraceMinutes ?? 30) || 0))),
      allowLateCheckOut: Boolean(settings.allowLateCheckOut),
      lateCheckOutGraceMinutes: Math.min(180, Math.max(0, Math.floor(Number(settings.lateCheckOutGraceMinutes ?? 30) || 0))),
    };

    setSavingAttendancePolicy(true);
    setAttendancePolicyMessage(backendEnabled ? "جاري حفظ سياسة تسجيل الحضور..." : "");
    try {
      if (backendEnabled) {
        await saveBackendSettings({
          allowEarlyCheckIn: next.allowEarlyCheckIn,
          earlyCheckInGraceMinutes: next.earlyCheckInGraceMinutes,
          allowLateCheckOut: next.allowLateCheckOut,
          lateCheckOutGraceMinutes: next.lateCheckOutGraceMinutes,
        });
        const remote = await getBackendSettings();
        const merged = { ...getSettings(), ...remote } as Settings;
        setSettings(merged);
        saveSettings(merged);
      } else {
        setSettings(next);
        saveSettings(next);
      }
      setAttendancePolicyMessage("تم حفظ سياسة تسجيل الحضور بنجاح.");
    } catch (e) {
      setAttendancePolicyMessage(e instanceof Error ? e.message : "تعذر حفظ سياسة تسجيل الحضور.");
    } finally {
      setSavingAttendancePolicy(false);
    }
  };

  const generateOwnerRecovery = async () => {
    if (generatingRecovery) return;
    if (!confirm("سيتم إبطال رمز استعادة المالك السابق وإنشاء رمز جديد. سيظهر الرمز مرة واحدة فقط. هل تريد المتابعة؟")) return;
    setGeneratingRecovery(true);
    setMessage("");
    setRecoveryCode("");
    try {
      const token = localStorage.getItem("hadir.api.token.admin") || "";
      const response = await fetch("https://hadir-api.abunizar963.workers.dev/api/auth/generate-owner-recovery", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({})) as { code?: string; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error || "تعذر إنشاء رمز استعادة جديد.");
      setRecoveryCode(data.code);
      setMessage("تم إنشاء رمز جديد. احفظه في مكان آمن؛ لن يظهر مرة أخرى.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر إنشاء رمز استعادة جديد.");
    } finally {
      setGeneratingRecovery(false);
    }
  };

  return <div className="space-y-4">
    <details className="hud-card group border-primary/40 overflow-hidden">
      <summary className="list-none cursor-pointer select-none p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-primary/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><AdminIcon /></span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-xs mono text-primary font-bold">ACCESS CONTROL · إدارة الصلاحيات</span>
            <span className="block mt-1 text-base font-bold">حسابات المدراء والمشرفين</span>
            <span className="block mt-1 text-xs text-muted-foreground">إضافة وإدارة الحسابات الإدارية والصلاحيات</span>
          </span>
        </div>
        <Chevron />
      </summary>
      <div className="border-t border-border/60 p-5 sm:p-6">
        <p className="text-sm text-muted-foreground mb-5">المالك فقط يستطيع إضافة المدراء والمشرفين. لا يمكن إنشاء مالك من هذه الواجهة.{backendEnabled && " البيانات محفوظة على الخادم."}</p>
        <div className="grid md:grid-cols-4 gap-3 items-end mb-5">
          <label className="text-xs">الاسم<input className="input mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المدير أو المشرف" /></label>
          <label className="text-xs">اسم المستخدم<input className="input mt-1" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" /></label>
          <label className="text-xs">كلمة المرور<input type="password" className="input mt-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="12 محرفًا على الأقل" /></label>
          <div className="flex gap-2"><select className="input" value={role} onChange={e=>setRole(e.target.value as "manager"|"supervisor")}><option value="manager">مدير</option><option value="supervisor">مشرف</option></select><button type="button" onClick={()=>void addAccount()} className="btn-primary whitespace-nowrap">+ إضافة</button></div>
        </div>
        {message && <div className="text-xs text-primary mb-4">{message}</div>}

        <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><AttendancePolicyIcon /></span>
            <div>
              <div className="font-bold text-sm">سياسة تسجيل الحضور والانصراف</div>
              <div className="text-xs text-muted-foreground mt-1 leading-5">تحكم في السماح بالتسجيل قبل بداية العمل وبعد نهاية الدوام، مع الحفاظ على التحقق من الموقع والجهاز ورمز QR.</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/70 p-3 cursor-pointer">
              <span><span className="block text-sm font-bold">السماح بالحضور قبل بداية العمل</span><span className="block text-[11px] text-muted-foreground mt-1">يفتح التسجيل المبكر ضمن المهلة المحددة أدناه.</span></span>
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={Boolean(settings.allowEarlyCheckIn)} onChange={e=>setSettings(prev=>({ ...prev, allowEarlyCheckIn: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/70 p-3 cursor-pointer">
              <span><span className="block text-sm font-bold">السماح بالانصراف بعد نهاية الدوام</span><span className="block text-[11px] text-muted-foreground mt-1">يبقى الانصراف متاحًا ضمن المهلة المحددة أدناه.</span></span>
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={Boolean(settings.allowLateCheckOut)} onChange={e=>setSettings(prev=>({ ...prev, allowLateCheckOut: e.target.checked }))} />
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs">مهلة الحضور قبل بداية العمل (بالدقائق)
              <input className="input mt-1" type="number" min="0" max="180" step="1" value={settings.earlyCheckInGraceMinutes ?? 30} onChange={e=>setSettings(prev=>({ ...prev, earlyCheckInGraceMinutes: Math.min(180, Math.max(0, Number(e.target.value) || 0)) }))} disabled={!settings.allowEarlyCheckIn} />
              <span className="block text-[11px] text-muted-foreground mt-1">مثال: 30 يعني السماح بالحضور من 30 دقيقة قبل البداية.</span>
            </label>
            <label className="text-xs">مهلة الانصراف بعد نهاية الدوام (بالدقائق)
              <input className="input mt-1" type="number" min="0" max="180" step="1" value={settings.lateCheckOutGraceMinutes ?? 30} onChange={e=>setSettings(prev=>({ ...prev, lateCheckOutGraceMinutes: Math.min(180, Math.max(0, Number(e.target.value) || 0)) }))} disabled={!settings.allowLateCheckOut} />
            </label>
          </div>
          {attendancePolicyMessage && <div className="mt-3 text-xs text-primary">{attendancePolicyMessage}</div>}
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary" disabled={savingAttendancePolicy} onClick={()=>void saveAttendancePolicy()}>{savingAttendancePolicy ? "جارٍ الحفظ…" : "حفظ سياسة الحضور"}</button>
          </div>
        </div>

        {backendEnabled && <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><div className="font-bold text-sm">🔐 رمز استعادة المالك</div><div className="text-xs text-muted-foreground mt-1">ينشئ رمزًا جديدًا ويبطل الرمز السابق. متاح للمالك فقط.</div></div>
            <button type="button" className="btn-secondary" disabled={generatingRecovery} onClick={()=>void generateOwnerRecovery()}>{generatingRecovery ? "⏳ جارٍ التوليد…" : "توليد رمز جديد"}</button>
          </div>
          {recoveryCode && <div className="mt-3 rounded-xl border border-primary/30 bg-background p-3"><div className="text-[11px] text-muted-foreground mb-1">احفظ هذا الرمز الآن — لن يظهر مرة أخرى:</div><div className="font-mono text-lg font-bold tracking-widest select-all break-all">{recoveryCode}</div></div>}
        </div>}

        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground px-3"><span>الاسم</span><span>المستخدم</span><span>الدور</span><span>الحالة / إجراء</span></div>
          <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30 text-sm items-center"><span className="font-bold">{owner?.name || settings.ownerName || "المالك"}</span><span className="mono">{owner?.username || settings.ownerUsername || "AbuNizar"}</span><span className="text-primary font-bold">مالك</span><span className="text-xs">دائمًا فعال</span></div>
          {displayAccounts.map(account=><div key={account.id} className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30 text-sm items-center"><span className="font-bold">{account.name}</span><span className="mono">{account.username}</span><span className="text-primary">{account.role === "manager" ? "مدير" : "مشرف"}</span><span className="flex gap-2 items-center"><button type="button" onClick={()=>void toggle(account.id,account.active)} className="text-xs underline">{account.active?"تعطيل":"تفعيل"}</button><button type="button" onClick={()=>void remove(account.id)} className="text-xs text-destructive underline">حذف</button></span></div>)}
          {displayAccounts.length===0 && <div className="text-center text-xs text-muted-foreground py-4">لا توجد حسابات مدير أو مشرف بعد.</div>}
        </div>
      </div>
    </details>
  </div>;
}
