import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAttendance, getEmployees, getSettings } from "@/lib/storage";
import { formatDate, formatDurationMinutes, formatTime, minutesBetween } from "@/lib/utils";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import { FileSpreadsheet, FileText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "daily" | "monthly";

export default function ManagerReports() {
  const [mode, setMode] = useState<Mode>("daily");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const employees = getEmployees();
  const settings = getSettings();
  const all = getAttendance();

  const rows = useMemo(() => {
    const [hh, mm] = settings.workStart.split(":").map(Number);
    if (mode === "daily") {
      return employees.map((e) => {
        const list = all.filter((r) => r.employeeId === e.id && r.timestamp.startsWith(date));
        const ci = list.find((r) => r.type === "check-in");
        const co = list.find((r) => r.type === "check-out");
        let late = 0;
        if (ci) {
          const sched = new Date(ci.timestamp); sched.setHours(hh, mm, 0, 0);
          late = Math.max(0, Math.round((new Date(ci.timestamp).getTime() - sched.getTime()) / 60000) - settings.lateGraceMinutes);
        }
        return { key:e.id, name:e.name, jobNumber:e.jobNumber, checkIn:ci?formatTime(ci.timestamp):"—", checkOut:co?formatTime(co.timestamp):"—", late, worked:ci&&co?minutesBetween(ci.timestamp,co.timestamp):0, status:!ci?"غياب":co?"منصرف":"حاضر" };
      });
    }
    return employees.map((e) => {
      const list = all.filter((r) => r.employeeId === e.id && r.timestamp.startsWith(month));
      const daysPresent = new Set(list.filter((r) => r.type === "check-in").map((r) => r.timestamp.slice(0,10)));
      let totalWorked=0,totalLate=0;
      Array.from(daysPresent).forEach((d) => {
        const ci=list.find((r)=>r.type==="check-in"&&r.timestamp.startsWith(d)); const co=list.find((r)=>r.type==="check-out"&&r.timestamp.startsWith(d));
        if(ci&&co) totalWorked+=minutesBetween(ci.timestamp,co.timestamp);
        if(ci){const sched=new Date(ci.timestamp);sched.setHours(hh,mm,0,0);totalLate+=Math.max(0,Math.round((new Date(ci.timestamp).getTime()-sched.getTime())/60000)-settings.lateGraceMinutes);}
      });
      return {key:e.id,name:e.name,jobNumber:e.jobNumber,checkIn:"",checkOut:"",late:totalLate,worked:totalWorked,daysPresent:daysPresent.size,status:""} as any;
    });
  }, [mode,date,month,employees,all,settings]);

  const exportData = () => {
    const headers: string[] = mode === "daily"
      ? ["الموظف","الرقم الوظيفي","الحضور","الانصراف","التأخر (دقيقة)","ساعات العمل","الحالة"]
      : ["الموظف","الرقم الوظيفي","أيام الحضور","إجمالي التأخر (دقيقة)","إجمالي ساعات العمل"];
    const body: CsvCell[][] = rows.map((r:any) => mode === "daily"
      ? [r.name,r.jobNumber,r.checkIn,r.checkOut,r.late,formatDurationMinutes(r.worked),r.status]
      : [r.name,r.jobNumber,r.daysPresent,r.late,formatDurationMinutes(r.worked)]);
    downloadCSV(`report-${mode}-${mode === "daily" ? date : month}`,headers,body);
  };

  const exportExcel = () => {
    const title = mode === "daily" ? `تقرير الحضور اليومي - ${formatDate(date)}` : `تقرير الحضور الشهري - ${month}`;
    const headers = mode === "daily"
      ? ["الموظف","الرقم الوظيفي","الحضور","الانصراف","التأخر (دقيقة)","ساعات العمل","الحالة"]
      : ["الموظف","الرقم الوظيفي","أيام الحضور","إجمالي التأخر (دقيقة)","إجمالي ساعات العمل"];
    const data = rows.map((r:any) => mode === "daily"
      ? [r.name,r.jobNumber,r.checkIn,r.checkOut,r.late,formatDurationMinutes(r.worked),r.status]
      : [r.name,r.jobNumber,r.daysPresent,r.late,formatDurationMinutes(r.worked)]);
    const summary = mode === "daily"
      ? ["ملخص", `إجمالي الموظفين: ${rows.length}`, `حاضر: ${rows.filter((r:any)=>r.status==="حاضر").length}`, `منصرف: ${rows.filter((r:any)=>r.status==="منصرف").length}`, `غياب: ${rows.filter((r:any)=>r.status==="غياب").length}`, `إجمالي التأخر: ${rows.reduce((n:any,r:any)=>n+r.late,0)} دقيقة`]
      : ["ملخص", `إجمالي الموظفين: ${rows.length}`, `إجمالي أيام الحضور: ${rows.reduce((n:any,r:any)=>n+r.daysPresent,0)}`, `إجمالي التأخر: ${rows.reduce((n:any,r:any)=>n+r.late,0)} دقيقة`, `إجمالي ساعات العمل: ${formatDurationMinutes(rows.reduce((n:any,r:any)=>n+r.worked,0))}`];
    const sheet = XLSX.utils.aoa_to_sheet([[title], summary, [], headers, ...data]);
    sheet["!merges"] = [{s:{r:0,c:0},e:{r:0,c:headers.length-1}}];
    sheet["!cols"] = headers.map((h,i)=>({wch:Math.max(16,h.length+4,i===0?22:0)}));
    const headerRow = 3;
    sheet["!autofilter"] = {ref:`A${headerRow+1}:${XLSX.utils.encode_col(headers.length-1)}${headerRow+1+data.length}`};
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,sheet,mode === "daily" ? "تقرير يومي" : "تقرير شهري");
    XLSX.writeFile(workbook,`Hadir-${mode}-report-${mode === "daily" ? date : month}.xlsx`);
  };

  return <ManagerLayout title="التقارير" subtitle={mode === "daily" ? `تقرير يومي · ${formatDate(date)}` : `تقرير شهري · ${month}`} actions={<div className="flex flex-wrap gap-2"><Button onClick={exportExcel} className="text-sm"><FileSpreadsheet className="ml-2 h-4 w-4"/>تصدير Excel ذكي</Button><Button onClick={exportData} variant="outline" className="text-sm"><FileText className="ml-2 h-4 w-4"/>CSV</Button></div>}>
    <div className="hud-card p-4 mb-5 space-y-3"><div className="flex flex-wrap items-center gap-3"><div className="inline-flex bg-secondary/50 rounded-xl p-1 border border-border/50"><button onClick={()=>setMode("daily")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${mode==="daily"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>يومي</button><button onClick={()=>setMode("monthly")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${mode==="monthly"?"bg-primary text-primary-foreground":"text-muted-foreground"}`}>شهري</button></div>{mode==="daily"?<input aria-label="تاريخ التقرير" type="date" className="input max-w-[200px] mono" value={date} onChange={e=>setDate(e.target.value)}/>:<input aria-label="شهر التقرير" type="month" className="input max-w-[200px] mono" value={month} onChange={e=>setMonth(e.target.value)}/>}</div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wand2 className="h-4 w-4 text-primary"/>تصدير Excel يتعرف تلقائيًا على نوع التقرير ويضيف ملخصًا وفلاتر وأعمدة مناسبة للتحليل.</div></div>
    <div className="hud-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground bg-secondary/40"><tr><Th>الموظف</Th><Th>الرقم</Th>{mode==="daily"?<><Th>الحضور</Th><Th>الانصراف</Th><Th>التأخر</Th><Th>ساعات العمل</Th><Th>الحالة</Th></>:<><Th>أيام الحضور</Th><Th>إجمالي التأخر</Th><Th>إجمالي ساعات العمل</Th></>}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.key} className="border-t border-border/50"><Td className="font-semibold">{r.name}</Td><Td className="mono">{r.jobNumber}</Td>{mode==="daily"?<><Td className="mono">{r.checkIn}</Td><Td className="mono">{r.checkOut}</Td><Td className={`mono ${r.late>0?"text-[hsl(var(--warning))]":""}`}>{r.late} د</Td><Td className="mono">{formatDurationMinutes(r.worked)}</Td><Td>{r.status==="غياب"?<span className="badge bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">غياب</span>:r.status==="منصرف"?<span className="badge bg-accent/15 text-accent">منصرف</span>:<span className="badge bg-primary/15 text-primary">حاضر</span>}</Td></>:<><Td className="mono">{r.daysPresent}</Td><Td className={`mono ${r.late>0?"text-[hsl(var(--warning))]":""}`}>{r.late} د</Td><Td className="mono">{formatDurationMinutes(r.worked)}</Td></>}</tr>)}</tbody></table></div></div>
  </ManagerLayout>;
}
function Th({children}:{children:React.ReactNode}){return <th className="text-right font-semibold px-3 py-2.5">{children}</th>;} function Td({children,className="",colSpan}:{children:React.ReactNode;className?:string;colSpan?:number}){return <td className={`px-3 py-2.5 ${className}`} colSpan={colSpan}>{children}</td>;}