import { useState } from "react";
import { getSettings, saveSettings } from "@/lib/storage";
import { hash } from "@/lib/hash";
import type { AdminAccount } from "@/types";

export default function AdminAccountsPanel() {
  const [settings, setSettings] = useState(getSettings());
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "supervisor">("manager");
  const [message, setMessage] = useState("");

  const accounts = (settings.adminAccounts || []).filter(a => a.role !== "owner");

  const save = (nextAccounts: AdminAccount[]) => {
    const next = { ...settings, adminAccounts: [
      ...(settings.adminAccounts || []).filter(a => a.role === "owner"),
      ...nextAccounts,
    ] };
    setSettings(next);
    saveSettings(next);
  };

  const addAccount = () => {
    const cleanName = name.trim();
    const cleanUsername = username.trim();
    if (!cleanName || !cleanUsername || password.length < 6) {
      setMessage("أدخل الاسم واسم المستخدم وكلمة مرور من 6 أحرف على الأقل.");
      return;
    }
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
    save([...accounts, account]);
    setName(""); setUsername(""); setPassword("");
    setMessage("تمت إضافة الحساب بنجاح.");
  };

  const toggle = (id: string) => save(accounts.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const remove = (id: string) => { if (confirm("حذف هذا الحساب الإداري؟")) save(accounts.filter(a => a.id !== id)); };

  return (
    <section className="hud-card p-5 sm:p-6 lg:col-span-2 border-primary/50 bg-primary/5">
      <div className="text-xs mono text-primary mb-1 font-bold">ACCESS CONTROL · إدارة الصلاحيات</div>
      <p className="text-sm text-muted-foreground mb-5">المالك فقط يستطيع إضافة المدراء والمشرفين. لا يمكن إنشاء مالك من هذه الواجهة.</p>
      <div className="grid md:grid-cols-4 gap-3 items-end mb-5">
        <label className="text-xs">الاسم<input className="input mt-1" value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المدير أو المشرف" /></label>
        <label className="text-xs">اسم المستخدم<input className="input mt-1" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username" /></label>
        <label className="text-xs">كلمة المرور<input type="password" className="input mt-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6 أحرف على الأقل" /></label>
        <div className="flex gap-2">
          <select className="input" value={role} onChange={e=>setRole(e.target.value as "manager"|"supervisor")}>
            <option value="manager">مدير</option><option value="supervisor">مشرف</option>
          </select>
          <button type="button" onClick={addAccount} className="btn-primary whitespace-nowrap">+ إضافة</button>
        </div>
      </div>
      {message && <div className="text-xs text-primary mb-4">{message}</div>}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2 text-[11px] text-muted-foreground px-3"><span>الاسم</span><span>المستخدم</span><span>الدور</span><span>الحالة / إجراء</span></div>
        <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30 text-sm items-center">
          <span className="font-bold">{settings.ownerName || "المالك"}</span><span className="mono">{settings.ownerUsername || "AbuNizar"}</span><span className="text-primary font-bold">مالك</span><span className="text-xs">دائمًا فعال</span>
        </div>
        {accounts.map(account => (
          <div key={account.id} className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-secondary/30 text-sm items-center">
            <span className="font-bold">{account.name}</span><span className="mono">{account.username}</span><span className="text-primary">{account.role === "manager" ? "مدير" : "مشرف"}</span>
            <span className="flex gap-2 items-center"><button type="button" onClick={()=>toggle(account.id)} className="text-xs underline">{account.active ? "تعطيل" : "تفعيل"}</button><button type="button" onClick={()=>remove(account.id)} className="text-xs text-destructive underline">حذف</button></span>
          </div>
        ))}
        {accounts.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">لا توجد حسابات مدير أو مشرف بعد.</div>}
      </div>
    </section>
  );
}
