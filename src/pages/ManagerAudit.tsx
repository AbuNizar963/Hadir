import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAudit } from "@/lib/storage";
import { formatDateTime } from "@/lib/utils";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import type { AuditEntry } from "@/types";

const ACTIONS: Record<AuditEntry["action"], string> = { login:"تسجيل دخول", "login-failed":"دخول فاشل", "check-in":"حضور", "check-out":"انصراف", "device-bound":"ربط جهاز", "manager-login":"دخول مدير", "manager-login-failed":"دخول مدير فاشل", "supervisor-login":"دخول مشرف", "supervisor-login-failed":"دخول مشرف فاشل", "owner-login":"دخول مالك", "owner-login-failed":"دخول مالك فاشل", "admin-login":"دخول إداري", "admin-login-failed":"دخول إداري فاشل" };
function safeAudit(): AuditEntry[] { try { const value=getAudit(); return Array.isArray(value)?value.filter((entry):entry is AuditEntry=>Boolean(entry&&typeof entry==="object")):[]; } catch(error){ console.error("Failed to load audit log",error); return []; } }
function actionLabel(action: AuditEntry["action"]): string { return ACTIONS[action]??String(action??"عملية غير معروفة"); }
function safeDate(value: unknown): string { try{return value?formatDateTime(String(value)):"—";}catch{return "—";} }

function exportExcel(rows: AuditEntry[], scope: "filtered"|"all") {
  const headers=["الوقت","الموظف","الرقم الوظيفي","العملية","النتيجة","السبب","الجهاز","IP","خط العرض","خط الطول","المسافة (م)"];
  const body=rows.map(a=>[safeDate(a.timestamp),a.actorName??"",a.jobNumber??"",actionLabel(a.action),a.result==="success"?"نجاح":"رفض",a.reason??"",a.deviceId??"",a.ip??"",a.lat??"",a.lng??"",a.distanceMeters??""]);
  const summary=[
    ["ملخص سجل التدقيق",""],
    ["عدد السجلات",rows.length],
    ["نجاح",rows.filter(a=>a.result==="success").length],
    ["رفض",rows.filter(a=>a.result!=="success").length],
    ["عدد الموظفين",new Set(rows.map(a=>a.jobNumber||a.actorName).filter(Boolean)).size],
    ["التصدير",scope==="filtered"?"السجلات المطابقة للفلاتر":"كل السجلات"],
    ["تاريخ التصدير",new Date().toLocaleString("ar-SA")],
  ];
  const wb=XLSX.utils.book_new();
  const wsSummary=XLSX.utils.aoa_to_sheet(summary); const wsData=XLSX.utils.aoa_to_sheet([headers,...body]);
  wsSummary["A1"].s={font:{bold:true}}; wsData["!autofilter"]={ref:`A1:K${Math.max(1,body.length+1)}`};
  wsSummary["!cols"]=[{wch:24},{wch:32}]; wsData["!cols"]=[{wch:21},{wch:22},{wch:16},{wch:18},{wch:12},{wch:30},{wch:24},{wch:18},{wch:14},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsSummary,"ملخص"); XLSX.utils.book_append_sheet(wb,wsData,"سجل التدقيق");
  XLSX.writeFile(wb,`audit-${new Date().toISOString().slice(0,10)}.xlsx`);
}

export default function ManagerAudit() {
  const [q,setQ]=useState(""); const [filter,setFilter]=useState<"all"|"success"|"rejected">("all"); const [action,setAction]=useState<"all"|AuditEntry["action"]>("all");
  const data=useMemo(()=>safeAudit(),[]);
  const filtered=useMemo(()=>{const s=q.trim().toLowerCase();return data.filter(a=>{if(filter!=="all"&&a.result!==filter)return false;if(action!=="all"&&a.action!==action)return false;if(s&&!(`${a.actorName??""} ${a.jobNumber??""} ${a.reason??""}`.toLowerCase().includes(s)))return false;return true;});},[data,q,filter,action]);
  const exportCsv=()=>{const headers=["الوقت","الموظف","الرقم الوظيفي","العملية","النتيجة","السبب","الجهاز","IP","خط العرض","خط الطول","المسافة (م)"];const body:CsvCell[][]=filtered.map(a=>[safeDate(a.timestamp),a.actorName??"",a.jobNumber??"",actionLabel(a.action),a.result==="success"?"نجاح":"رفض",a.reason??"",a.deviceId??"",a.ip??"",a.lat??"",a.lng??"",a.distanceMeters??""]);downloadCSV(`audit-${new Date().toISOString().slice(0,10)}`,headers,body);};
  return <ManagerLayout title="سجل التدقيق" subtitle="جميع العمليات، سواء الناجحة أو المرفوضة. غير قابل للتعديل من الموظف." actions={<div className="flex flex-wrap gap-2"><button onClick={()=>exportExcel(filtered,"filtered")} className="btn-primary text-sm">تصدير Excel ذكي</button><button onClick={exportCsv} className="btn-secondary text-sm">تصدير CSV</button></div>}>
    <div className="hud-card p-4 mb-5 grid md:grid-cols-4 gap-3"><input className="input md:col-span-2" placeholder="بحث بالاسم / الرقم / السبب..." value={q} onChange={e=>setQ(e.target.value)}/><select className="input" value={filter} onChange={e=>setFilter(e.target.value as "all"|"success"|"rejected")}><option value="all">كل النتائج</option><option value="success">ناجحة فقط</option><option value="rejected">مرفوضة فقط</option></select><select className="input" value={action} onChange={e=>setAction(e.target.value as "all"|AuditEntry["action"])}><option value="all">كل العمليات</option>{Object.entries(ACTIONS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <div className="hud-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground bg-secondary/40"><tr><Th>الوقت</Th><Th>الموظف</Th><Th>العملية</Th><Th>النتيجة</Th><Th>السبب</Th><Th>الموقع</Th><Th>الجهاز</Th></tr></thead><tbody>{filtered.map((a,index)=>{const hasLocation=typeof a.lat==="number"&&Number.isFinite(a.lat)&&typeof a.lng==="number"&&Number.isFinite(a.lng);return <tr key={a.id??`audit-${index}`} className="border-t border-border/50 align-top"><Td className="mono text-xs whitespace-nowrap">{safeDate(a.timestamp)}</Td><Td><div className="font-semibold">{a.actorName??"غير معروف"}</div><div className="mono text-xs text-muted-foreground">{a.jobNumber??"—"}</div></Td><Td className="text-xs">{actionLabel(a.action)}</Td><Td>{a.result==="success"?<span className="badge bg-primary/15 text-primary">نجاح</span>:<span className="badge bg-destructive/15 text-destructive">رفض</span>}</Td><Td className="text-xs max-w-[220px]">{a.reason??"—"}</Td><Td className="mono text-[11px]">{hasLocation?<>{a.lat!.toFixed(4)}, {a.lng!.toFixed(4)}{typeof a.distanceMeters==="number"&&<div className="text-muted-foreground">{a.distanceMeters} م</div>}</>:"—"}</Td><Td className="mono text-[10px] text-muted-foreground max-w-[140px] break-all">{a.deviceId??"—"}</Td></tr>;})}{filtered.length===0&&<tr><Td colSpan={7} className="text-center text-muted-foreground py-8">لا توجد سجلات مطابقة.</Td></tr>}</tbody></table></div></div>
  </ManagerLayout>;
}
function Th({children}:{children:React.ReactNode}){return <th className="text-right font-semibold px-3 py-2.5">{children}</th>;} function Td({children,className="",colSpan}:{children:React.ReactNode;className?:string;colSpan?:number}){return <td className={`px-3 py-2.5 ${className}`} colSpan={colSpan}>{children}</td>;}
