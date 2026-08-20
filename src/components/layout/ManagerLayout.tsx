import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { cn } from "@/lib/utils";
import { getNotifications, markAsRead as markNotificationAsRead } from "@/lib/notifications";
import type { AppNotification } from "@/lib/notifications";
import { getManagerSession, setManagerSession } from "@/lib/storage";
import { backendLogout } from "@/lib/backend";

const NAV = [
  { to: "/manager", label: "لوحة القيادة", end: true },
  { to: "/manager/employees", label: "الموظفون", editRoles: ["owner","manager"] },
  { to: "/manager/audit", label: "سجل التدقيق", editRoles: ["owner","manager","supervisor"] },
  { to: "/manager/reports", label: "التقارير", editRoles: ["owner","manager"] },
  { to: "/manager/settings", label: "الإعدادات", editRoles: ["owner"] },
];

export default function ManagerLayout({title,subtitle,actions,children}:{title:string;subtitle?:string;actions?:React.ReactNode;children:React.ReactNode}){
  const nav=useNavigate(); const managerSession=getManagerSession(); const currentRole=managerSession?.role||"manager";
  const [notifications,setNotifications]=useState<AppNotification[]>([]); const [showNotifications,setShowNotifications]=useState(false); const [menuOpen,setMenuOpen]=useState(false); const [themeMenuOpen,setThemeMenuOpen]=useState(false); const [theme,setTheme]=useState("system");
  useEffect(()=>{const load=()=>{try{const all=getNotifications();setNotifications(Array.isArray(all)?all.filter(n=>n.userId==="manager"||n.userId==="admin"||n.userId==="all"):[]);}catch(e){console.error(e)}};load();const i=setInterval(load,3000);return()=>clearInterval(i)},[]);
  const unreadCount=notifications.filter(n=>!n.read).length;
  const logout=()=>{localStorage.removeItem("managerAuth");backendLogout();setManagerSession(null);nav("/manager/login");};
  const filteredNav=NAV.filter(n=>!n.editRoles||n.editRoles.includes(currentRole));
  useEffect(()=>{if(theme==="system")document.documentElement.classList.toggle("dark",window.matchMedia("(prefers-color-scheme: dark)").matches);else document.documentElement.classList.toggle("dark",theme==="dark")},[theme]);
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed top-0 right-0 bottom-0 w-64 border-l border-border/70 bg-sidebar/95 backdrop-blur-md hidden lg:flex flex-col z-40"><div className="p-5 border-b border-border/60 flex items-center justify-between"><Brand/></div>{managerSession&&<div className="px-5 py-2.5 border-b border-border/40 text-xs text-muted-foreground bg-secondary/30">مرحباً، <span className="font-bold text-foreground">{managerSession.name||currentRole}</span></div>}<nav className="flex-1 p-3 space-y-1">{filteredNav.map(n=><NavLink key={n.to} to={n.to} end={n.end as any} className={({isActive})=>cn("block rounded-xl px-3 py-2.5 text-sm font-semibold transition",isActive?"bg-primary/15 text-primary border border-primary/30":"text-foreground/80 hover:bg-secondary hover:text-foreground")}>{n.label}</NavLink>)}</nav></aside>
    <div className="lg:mr-64"><div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/60"><div className="px-4 py-3 flex items-center justify-between"><Brand/><button onClick={()=>setMenuOpen(!menuOpen)} className="p-2 rounded-lg border border-border text-sm font-semibold">☰</button></div><div className="px-2 pb-2 flex gap-1 overflow-x-auto">{filteredNav.map(n=><NavLink key={n.to} to={n.to} end={n.end as any} className={({isActive})=>cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold",isActive?"bg-primary/15 text-primary":"text-muted-foreground hover:text-foreground")}>{n.label}</NavLink>)}</div>{menuOpen&&<div className="absolute left-3 top-14 w-56 bg-card border border-border rounded-xl shadow-lg p-2 z-50"><button onClick={()=>{setShowNotifications(true);setMenuOpen(false)}} className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm">🔔 الإشعارات {unreadCount>0&&`(${unreadCount})`}</button><div className="border-t my-1"/><button onClick={()=>{setTheme("dark");setMenuOpen(false)}} className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm">🌙 الوضع الداكن</button><button onClick={()=>{setTheme("light");setMenuOpen(false)}} className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm">☀️ الوضع المشرق</button><button onClick={logout} className="w-full text-right px-3 py-2 rounded-lg hover:bg-secondary text-sm text-red-600">🚪 تسجيل خروج</button></div>}</div>
      <header className="px-5 lg:px-10 pt-6 pb-4 border-b border-border/40 mb-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs text-muted-foreground mono">MANAGER · {currentRole.toUpperCase()}</div><h1 className="text-2xl md:text-3xl font-extrabold mt-1">{title}</h1>{subtitle&&<div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}</div>{actions}</div></header>
      <main className="px-5 lg:px-10 pb-16">{children}</main>
    </div>
    {showNotifications&&<div className="fixed inset-0 z-50 bg-black/30" onClick={()=>setShowNotifications(false)}><div className="absolute left-4 top-4 w-80 max-w-[calc(100%-2rem)] bg-card border border-border rounded-2xl shadow-xl p-4" onClick={e=>e.stopPropagation()}><div className="font-bold mb-3">الإشعارات</div>{notifications.length===0?<div className="text-sm text-muted-foreground">لا توجد إشعارات.</div>:notifications.map(n=><button key={n.id} onClick={()=>{markNotificationAsRead(n.id);setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}} className="block w-full text-right p-2 rounded-lg hover:bg-secondary text-sm">{n.title || n.body}</button>)}</div></div>}
  </div>;
}
