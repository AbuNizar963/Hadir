import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "owner" | "manager" | "supervisor" | "staff";
type AttendanceType = "check-in" | "check-out";
type Status = "active" | "suspended";

type Employee = {
  id: string;
  jobNumber: string;
  name: string;
  pin: string;
  status: Status;
  role: Role;
  deviceId: string | null;
  createdAt: string;
};

type Attendance = {
  id: string;
  employeeId: string;
  jobNumber: string;
  employeeName: string;
  type: AttendanceType;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  deviceId: string;
  source: "employee" | "manager";
};

type Audit = {
  id: string;
  action: string;
  actor: string;
  result: "success" | "rejected";
  reason?: string;
  timestamp: string;
};

type Settings = {
  siteName: string;
  siteLat: number;
  siteLng: number;
  radius: number;
  siteCode: string;
  workStart: string;
  workEnd: string;
  grace: number;
};

type Session = { kind: "employee"; employeeId: string } | { kind: "manager"; role: Exclude<Role, "staff">; name: string };

const KEY = "hadir.v2";
const defaultSettings: Settings = {
  siteName: "المقر الرئيسي",
  siteLat: 36.2021,
  siteLng: 37.1343,
  radius: 150,
  siteCode: "HADIR-01",
  workStart: "08:00",
  workEnd: "16:00",
  grace: 10,
};

const defaultEmployees: Employee[] = [
  { id: "owner", jobNumber: "963", name: "المالك", pin: "963", status: "active", role: "owner", deviceId: null, createdAt: new Date().toISOString() },
  { id: "employee-1001", jobNumber: "1001", name: "أحمد الموظف", pin: "1001", status: "active", role: "staff", deviceId: null, createdAt: new Date().toISOString() },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${KEY}.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(`${KEY}.${key}`, JSON.stringify(value));
}

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deviceId() {
  const key = `${KEY}.device`;
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto?.randomUUID?.() ?? id();
    localStorage.setItem(key, value);
  }
  return value;
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fmt(value: string) {
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function initialState() {
  const employees = load<Employee[]>("employees", defaultEmployees);
  if (!localStorage.getItem(`${KEY}.employees`)) save("employees", employees);
  if (!localStorage.getItem(`${KEY}.attendance`)) save<Attendance[]>("attendance", []);
  if (!localStorage.getItem(`${KEY}.audit`)) save<Audit[]>("audit", []);
  if (!localStorage.getItem(`${KEY}.settings`)) save("settings", defaultSettings);
}

initialState();

function logAudit(action: string, actor: string, result: Audit["result"], reason?: string) {
  const rows = load<Audit[]>("audit", []);
  rows.unshift({ id: id(), action, actor, result, reason, timestamp: new Date().toISOString() });
  save("audit", rows.slice(0, 2000));
}

function useStore<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  const update = (next: T) => { setValue(next); save(key, next); };
  return [value, update] as const;
}

export default function App() {
  const [page, setPage] = useState("home");
  const [session, setSession] = useState<Session | null>(() => load<Session | null>("session", null));
  const [employees, setEmployees] = useStore<Employee[]>("employees", defaultEmployees);
  const [attendance, setAttendance] = useStore<Attendance[]>("attendance", []);
  const [settings, setSettings] = useStore<Settings>("settings", defaultSettings);
  const [audit, setAudit] = useStore<Audit[]>("audit", []);

  const logout = () => { setSession(null); localStorage.removeItem(`${KEY}.session`); setPage("home"); };
  const loginEmployee = (job: string, pin: string) => {
    const employee = employees.find(e => e.jobNumber === job.trim());
    if (!employee || employee.status !== "active" || employee.pin !== pin) {
      logAudit("تسجيل دخول موظف", job, "rejected", "بيانات الدخول غير صحيحة أو الحساب موقوف");
      setAudit(load<Audit[]>("audit", []));
      return "الرقم الوظيفي أو رمز الدخول غير صحيح";
    }
    const currentDevice = deviceId();
    if (employee.deviceId && employee.deviceId !== currentDevice) {
      logAudit("تسجيل دخول موظف", employee.name, "rejected", "الجهاز غير موثّق");
      setAudit(load<Audit[]>("audit", []));
      return "هذا الجهاز غير موثّق للحساب. اطلب من الإدارة إعادة ربط الجهاز.";
    }
    if (!employee.deviceId) {
      const next = employees.map(e => e.id === employee.id ? { ...e, deviceId: currentDevice } : e);
      setEmployees(next);
      logAudit("ربط جهاز", employee.name, "success");
    }
    const nextSession: Session = { kind: "employee", employeeId: employee.id };
    setSession(nextSession); save("session", nextSession); setPage("employee");
    logAudit("تسجيل دخول موظف", employee.name, "success"); setAudit(load<Audit[]>("audit", []));
    return null;
  };

  const loginManager = (username: string, password: string) => {
    const normalized = username.trim();
    const role = normalized === "963" && password === "963" ? "owner" : normalized === "manager" && password === "manager" ? "manager" : normalized === "supervisor" && password === "supervisor" ? "supervisor" : null;
    if (!role) {
      logAudit("تسجيل دخول إداري", normalized, "rejected", "بيانات الدخول غير صحيحة");
      setAudit(load<Audit[]>("audit", []));
      return "اسم المستخدم أو كلمة المرور غير صحيحة";
    }
    const name = role === "owner" ? "المالك" : role === "manager" ? "المدير" : "المشرف";
    const nextSession: Session = { kind: "manager", role, name };
    setSession(nextSession); save("session", nextSession); setPage("dashboard");
    logAudit("تسجيل دخول إداري", name, "success"); setAudit(load<Audit[]>("audit", []));
    return null;
  };

  const employee = session?.kind === "employee" ? employees.find(e => e.id === session.employeeId) ?? null : null;
  if (!session) {
    if (page === "employee-login") return <Login title="دخول الموظفين" onBack={() => setPage("home")} onSubmit={loginEmployee} employee />;
    if (page === "manager-login") return <Login title="دخول الإدارة" onBack={() => setPage("home")} onSubmit={loginManager} />;
    return <Landing onEmployee={() => setPage("employee-login")} onManager={() => setPage("manager-login")} />;
  }

  if (session.kind === "employee" && employee) {
    return <EmployeePanel employee={employee} settings={settings} attendance={attendance} onAttendance={(record) => { setAttendance([record, ...attendance]); logAudit(record.type === "check-in" ? "حضور" : "انصراف", employee.name, "success"); setAudit(load<Audit[]>("audit", [])); }} onLogout={logout} />;
  }

  if (session.kind === "manager") {
    return <ManagerPanel role={session.role} name={session.name} employees={employees} setEmployees={setEmployees} attendance={attendance} setAttendance={setAttendance} settings={settings} setSettings={setSettings} audit={audit} onLogout={logout} />;
  }
  return null;
}

function Landing({ onEmployee, onManager }: { onEmployee: () => void; onManager: () => void }) {
  return <main className="shell center"><section className="hero"><div className="logo">ح</div><h1>حاضِر</h1><p>نظام حضور وانصراف حديث للموظفين والإدارة</p><div className="actions"><button onClick={onEmployee}>دخول الموظفين</button><button className="secondary" onClick={onManager}>لوحة الإدارة</button></div><div className="note">الحضور يعتمد على الجهاز الموثّق والموقع الجغرافي داخل نطاق العمل.</div></section></main>;
}

function Login({ title, onBack, onSubmit, employee = false }: { title: string; onBack: () => void; onSubmit: (a: string, b: string) => string | null; employee?: boolean }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [error, setError] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); const err = onSubmit(a, b); if (err) setError(err); };
  return <main className="shell center"><form className="card login" onSubmit={submit}><button type="button" className="back" onClick={onBack}>← العودة</button><div className="logo small">ح</div><h2>{title}</h2><label>{employee ? "الرقم الوظيفي" : "اسم المستخدم"}<input value={a} onChange={e => setA(e.target.value)} autoComplete="username" required /></label><label>{employee ? "رمز الدخول" : "كلمة المرور"}<input type="password" value={b} onChange={e => setB(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="error">{error}</div>}<button type="submit">تسجيل الدخول</button>{employee && <div className="hint">للتجربة الأولى: الموظف 1001 والرمز 1001</div>}</form></main>;
}

function EmployeePanel({ employee, settings, attendance, onAttendance, onLogout }: { employee: Employee; settings: Settings; attendance: Attendance[]; onAttendance: (r: Attendance) => void; onLogout: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const mine = attendance.filter(a => a.employeeId === employee.id && a.timestamp.startsWith(today)).sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  const last = mine[mine.length - 1];
  const nextType: AttendanceType = last?.type === "check-in" ? "check-out" : "check-in";
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  const mark = () => {
    setBusy(true); setMessage("");
    if (!navigator.geolocation) { setBusy(false); setMessage("المتصفح لا يدعم تحديد الموقع."); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      const distance = distanceMeters(settings.siteLat, settings.siteLng, pos.coords.latitude, pos.coords.longitude);
      if (distance > settings.radius) { setBusy(false); setMessage(`أنت خارج نطاق العمل. المسافة ${Math.round(distance)} متر.`); return; }
      const record: Attendance = { id: id(), employeeId: employee.id, jobNumber: employee.jobNumber, employeeName: employee.name, type: nextType, timestamp: new Date().toISOString(), lat: pos.coords.latitude, lng: pos.coords.longitude, distance, deviceId: deviceId(), source: "employee" };
      onAttendance(record); setBusy(false); setMessage(nextType === "check-in" ? "تم تسجيل الحضور بنجاح." : "تم تسجيل الانصراف بنجاح.");
    }, () => { setBusy(false); setMessage("تعذر الحصول على الموقع. فعّل صلاحية الموقع وحاول مجددًا."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  return <main className="shell"><header><div><b>حاضِر</b><span>{settings.siteName}</span></div><button className="ghost" onClick={onLogout}>خروج</button></header><section className="grid two"><div className="card profile"><div className="avatar">{employee.name.slice(0,1)}</div><h2>{employee.name}</h2><p>الرقم الوظيفي: {employee.jobNumber}</p><span className="badge">الجهاز موثّق</span></div><div className="card action-card"><h2>{nextType === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف"}</h2><p>يجب أن تكون داخل نطاق {settings.radius} متر من موقع العمل.</p><button onClick={mark} disabled={busy}>{busy ? "جارٍ التحقق من الموقع..." : nextType === "check-in" ? "تسجيل الحضور" : "تسجيل الانصراف"}</button>{message && <div className="notice">{message}</div>}</div></section><section className="card"><h3>سجل اليوم</h3>{mine.length === 0 ? <p className="muted">لا توجد حركات اليوم.</p> : <div className="table">{mine.map(r => <div className="row" key={r.id}><span>{r.type === "check-in" ? "حضور" : "انصراف"}</span><span>{fmt(r.timestamp)}</span><span>{r.distance == null ? "إداري" : `${Math.round(r.distance)} م`}</span></div>)}</div>}</section></main>;
}

function ManagerPanel({ role, name, employees, setEmployees, attendance, setAttendance, settings, setSettings, audit, onLogout }: { role: Exclude<Role,"staff">; name: string; employees: Employee[]; setEmployees: (v: Employee[]) => void; attendance: Attendance[]; setAttendance: (v: Attendance[]) => void; settings: Settings; setSettings: (v: Settings) => void; audit: Audit[]; onLogout: () => void }) {
  const [tab, setTab] = useState("dashboard");
  const [query, setQuery] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.timestamp.startsWith(today));
  const filtered = employees.filter(e => `${e.name} ${e.jobNumber}`.includes(query));
  const canEdit = role === "owner" || role === "manager";
  const addEmployee = () => {
    if (!canEdit) return;
    const job = prompt("الرقم الوظيفي"); const nameValue = prompt("اسم الموظف"); const pin = prompt("رمز الدخول");
    if (!job || !nameValue || !pin || employees.some(e => e.jobNumber === job)) return;
    setEmployees([...employees, { id: id(), jobNumber: job, name: nameValue, pin, status: "active", role: "staff", deviceId: null, createdAt: new Date().toISOString() }]);
  };
  const toggleEmployee = (emp: Employee) => setEmployees(employees.map(e => e.id === emp.id ? { ...e, status: e.status === "active" ? "suspended" : "active" } : e));
  const manual = (emp: Employee, type: AttendanceType) => {
    const record: Attendance = { id: id(), employeeId: emp.id, jobNumber: emp.jobNumber, employeeName: emp.name, type, timestamp: new Date().toISOString(), lat: null, lng: null, distance: null, deviceId: emp.deviceId ?? "manager", source: "manager" };
    setAttendance([record, ...attendance]);
  };
  return <main className="shell"><header><div><b>حاضِر</b><span>لوحة الإدارة · {name}</span></div><button className="ghost" onClick={onLogout}>خروج</button></header><nav className="tabs">{[["dashboard","الرئيسية"],["employees","الموظفون"],["attendance","الحضور"],["audit","السجل"],["settings","الإعدادات"]].map(([key,label]) => <button key={key} className={tab===key?"active":""} onClick={() => setTab(key)}>{label}</button>)}</nav>{tab === "dashboard" && <section className="grid stats"><Stat title="الموظفون" value={employees.length}/><Stat title="حضور اليوم" value={todayAttendance.filter(a=>a.type==="check-in").length}/><Stat title="انصراف اليوم" value={todayAttendance.filter(a=>a.type==="check-out").length}/><Stat title="المتواجدون" value={todayAttendance.filter(a=>a.type==="check-in").filter(a => !todayAttendance.some(x => x.employeeId===a.employeeId && x.type==="check-out" && x.timestamp>a.timestamp)).length}/></section>}{tab === "employees" && <section className="card"><div className="toolbar"><input placeholder="بحث بالاسم أو الرقم..." value={query} onChange={e=>setQuery(e.target.value)}/>{canEdit && <button onClick={addEmployee}>إضافة موظف</button>}</div><div className="table">{filtered.map(e=><div className="row employee-row" key={e.id}><div><b>{e.name}</b><small>{e.jobNumber}</small></div><span className={e.status === "active" ? "badge" : "badge danger"}>{e.status === "active" ? "فعال" : "موقوف"}</span><span>{e.deviceId ? "جهاز موثّق" : "غير مربوط"}</span>{canEdit && <button className="smallbtn" onClick={()=>toggleEmployee(e)}>{e.status === "active" ? "إيقاف" : "تفعيل"}</button>}</div>)}</div></section>}{tab === "attendance" && <section className="card"><h2>حركات الحضور والانصراف</h2><div className="table">{attendance.slice(0,100).map(a=><div className="row" key={a.id}><span>{a.employeeName}</span><span>{a.type === "check-in" ? "حضور" : "انصراف"}</span><span>{fmt(a.timestamp)}</span><span>{a.source === "manager" ? "إداري" : `${Math.round(a.distance ?? 0)} م`}</span></div>)}</div></section>}{tab === "audit" && <section className="card"><h2>سجل التدقيق</h2><div className="table">{audit.slice(0,100).map(a=><div className="row" key={a.id}><span>{a.action}</span><span>{a.actor}</span><span>{fmt(a.timestamp)}</span><span className={a.result === "success" ? "ok" : "bad"}>{a.result === "success" ? "نجاح" : "رفض"}</span></div>)}</div></section>}{tab === "settings" && <section className="card settings">{role !== "owner" ? <p className="muted">الإعدادات الأساسية متاحة للمالك فقط.</p> : <><label>اسم الموقع<input value={settings.siteName} onChange={e=>setSettings({...settings,siteName:e.target.value})}/></label><div className="grid two"><label>خط العرض<input type="number" value={settings.siteLat} onChange={e=>setSettings({...settings,siteLat:Number(e.target.value)})}/></label><label>خط الطول<input type="number" value={settings.siteLng} onChange={e=>setSettings({...settings,siteLng:Number(e.target.value)})}/></label><label>نطاق الموقع بالمتر<input type="number" min="10" value={settings.radius} onChange={e=>setSettings({...settings,radius:Math.max(10,Number(e.target.value))})}/></label><label>رمز الموقع الثابت<input value={settings.siteCode} onChange={e=>setSettings({...settings,siteCode:e.target.value})}/></label><label>بداية الدوام<input type="time" value={settings.workStart} onChange={e=>setSettings({...settings,workStart:e.target.value})}/></label><label>نهاية الدوام<input type="time" value={settings.workEnd} onChange={e=>setSettings({...settings,workEnd:e.target.value})}/></label></div><button onClick={()=>{save("settings",settings); alert("تم حفظ الإعدادات");}}>حفظ الإعدادات</button></>}</section>}{tab === "dashboard" && canEdit && <section className="card"><h2>إجراء إداري سريع</h2><p className="muted">يمكن للإدارة تسجيل حركة يدوية عند الحاجة مع ظهورها كمصدر إداري في السجل.</p><div className="quick">{employees.filter(e=>e.role==="staff").slice(0,8).map(e=><div key={e.id}><b>{e.name}</b><button className="smallbtn" onClick={()=>manual(e,"check-in")}>حضور</button><button className="smallbtn" onClick={()=>manual(e,"check-out")}>انصراف</button></div>)}</div></section>}</main>;
}

function Stat({ title, value }: { title: string; value: number }) { return <div className="card stat"><span>{title}</span><strong>{value}</strong></div>; }
