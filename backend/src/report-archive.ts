import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";
import * as XLSX from "xlsx-js-style";

type Env = { DB: D1Database; REPORT_ARCHIVES?: R2Bucket; APP_TIMEZONE?: string };
type ArchiveRow = { report_id: string; report_type: string; period_from: string; period_to: string; employee_id: string | null; generated_at: string; generated_by: string; generated_by_name: string; report_version: string; data_snapshot_hash: string; status: string; file_key: string; file_name: string; file_size: number; mime_type: string; file_sha256: string; created_at: string; locked_at: string | null; locked_by: string | null; revision: number };
const CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ARCHIVE_VERSION = "1.0";
function localYearMonth(now: Date, timezone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now); return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value) }; }
function previousMonthPeriod(now: Date, timezone: string) { const current = localYearMonth(now, timezone); const previous = new Date(Date.UTC(current.year, current.month - 2, 1)); const year = previous.getUTCFullYear(), month = previous.getUTCMonth() + 1, lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(), mm = String(month).padStart(2, "0"); return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`, year, month }; }
function jsonBytes(value: unknown) { return new TextEncoder().encode(JSON.stringify(value)); }
async function sha256Hex(value: Uint8Array) { const digest = await crypto.subtle.digest("SHA-256", value); return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(""); }
function minutes(value: unknown) { const n = Number(value || 0); return `${Math.floor(n / 60)}س ${n % 60}د`; }
function statusArabic(status: string) { const map: Record<string, string> = { PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غياب", REST: "راحة", LEAVE: "إجازة", PERMISSION: "إذن", ESCAPED: "انصراف دون إذن", NOT_STARTED: "لم يبدأ", INVALID: "غير صالح", OPEN: "مفتوح" }; return map[status] || status; }

function makeWorkbook(report: any) {
  const wb = XLSX.utils.book_new();
  const summaryRows = [["حاضر · التقرير الشهري المؤرشف"],["الفترة",`${report.from} → ${report.to}`],["وقت الإنشاء",report.generatedAt],["المنطقة الزمنية",report.timezone],[],["المؤشر","القيمة"],["الموظفون",report.summary.employees],["أيام الموظفين",report.summary.employeeDays],["حاضر",report.summary.present],["متأخر",report.summary.late],["غياب",report.summary.absent],["إجازة",report.summary.leave],["إذن",report.summary.permission],["راحة",report.summary.rest],["انصراف دون إذن",report.summary.escaped],["لم يبدأ",report.summary.notStarted],["غير صالح",report.summary.invalid],["مفتوح",report.summary.open],["ساعات العمل",minutes(report.summary.workedMinutes)],["ساعات العمل المتوقعة",minutes(report.summary.expectedMinutes)],["فرق العمل",minutes(report.summary.workVarianceMinutes)],["دقائق التأخر",report.summary.lateMinutes],["دقائق الانصراف المبكر",report.summary.earlyLeaveMinutes],["دقائق العمل الإضافي",report.summary.overtimeMinutes],["نسبة الحضور",`${report.summary.attendanceRate}%`],["نسبة الالتزام بالمواعيد",`${report.summary.punctualityRate}%`]];
  const dailyRows = [["التاريخ","حاضر","متأخر","غياب","إجازة","إذن","راحة","دون إذن","مفتوح","عمل","متوقع","تأخر","مبكر","إضافي"], ...report.analytics.dailySeries.map((r:any)=>[r.attendanceDay,r.present,r.late,r.absent,r.leave,r.permission,r.rest,r.escaped,r.open,minutes(r.workedMinutes),minutes(r.expectedMinutes),r.lateMinutes,r.earlyLeaveMinutes,r.overtimeMinutes])];
  const employeeRows = [["الموظف","الرقم الوظيفي","الأيام","حاضر","متأخر","غياب","إجازة","إذن","راحة","دون إذن","مفتوح","العمل","المتوقع","التأخر","المبكر","الإضافي"], ...report.analytics.employeeSummaries.map((r:any)=>[r.employeeName,r.jobNumber||"",r.days,r.present,r.late,r.absent,r.leave,r.permission,r.rest,r.escaped,r.open,minutes(r.workedMinutes),minutes(r.expectedMinutes),r.lateMinutes,r.earlyLeaveMinutes,r.overtimeMinutes])];
  const detailRows = [["التاريخ","الموظف","الرقم","الحالة","المصدر","بداية الدوام","نهاية الدوام","الحضور","الانصراف","العمل","التأخر","المبكر","الإضافي","رمز الاستثناء","جودة البيانات","مصدر الحساب"], ...report.rows.map((r:any)=>[r.attendanceDay,r.employeeName,r.jobNumber||"",statusArabic(r.status),r.attendanceSource,r.scheduledStart||"",r.scheduledEnd||"",r.checkInAt||"",r.checkOutAt||"",minutes(r.workedMinutes),r.lateMinutes,r.earlyLeaveMinutes,r.overtimeMinutes,r.exceptionCode||"",r.historicalDataQuality,r.calculationSource])];
  const exceptionRows = [["التاريخ","الموظف","الرقم","الاستثناء","الحالة","المصدر","الدقائق","معرّفات الحضور","معرّفات الطلبات","معرّفات التدقيق"], ...report.analytics.exceptions.map((r:any)=>[r.attendanceDay,r.employeeName,r.jobNumber||"",r.code,statusArabic(r.status),r.attendanceSource,r.minutes,(r.attendanceEventIds||[]).join(", "),(r.requestIds||[]).join(", "),(r.auditIds||[]).join(", ")])];
  for (const [name,rows] of [["الملخص",summaryRows],["اليومي",dailyRows],["الموظفون",employeeRows],["التفاصيل",detailRows],["الاستثناءات",exceptionRows]] as Array<[string,any[][]]>) {
    const ws=XLSX.utils.aoa_to_sheet(rows); ws["!cols"]=Array.from({length:Math.max(...rows.map(r=>r.length),1)},(_,c)=>({wch:Math.min(42,Math.max(12,...rows.map(r=>String(r[c]??"").length+2)))})); const range=XLSX.utils.decode_range(ws["!ref"]||"A1:A1");
    for(let c=range.s.c;c<=range.e.c;c++){const cell=ws[XLSX.utils.encode_cell({r:0,c})];if(cell)cell.s={font:{name:"Arial",bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:"173F5F"}},alignment:{horizontal:"center",vertical:"center",wrapText:true}};}
    for(let r=1;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell)cell.s={...(cell.s||{}),font:{name:"Arial",sz:10},alignment:{horizontal:"center",vertical:"center",wrapText:true}};}
    XLSX.utils.book_append_sheet(wb,ws,name);
  }
  wb.Workbook=wb.Workbook||{}; wb.Workbook.Views=[{RTL:true}]; return XLSX.write(wb,{bookType:"xlsx",type:"array",compression:true});
}
function archiveKey(period:{year:number;month:number}){const mm=String(period.month).padStart(2,"0");return `reports/${period.year}/${mm}/attendance-period-${period.year}-${mm}.xlsx`;}

async function claimArchive(env:Env,id:string,from:string,to:string,key:string){
  const now=new Date().toISOString(), fileName=key.split("/").pop()||key;
  await env.DB.prepare(`INSERT OR IGNORE INTO report_archives (report_id,report_type,period_from,period_to,employee_id,generated_at,generated_by,generated_by_name,report_version,data_snapshot_hash,status,file_key,file_name,file_size,mime_type,file_sha256,created_at,revision) VALUES (?,?,?,?,NULL,?,?,?,?,?,'CALCULATED',?,?,0,?,'pending',?,1)`).bind(id,"attendance_period",from,to,now,"system","التلقائي",ARCHIVE_VERSION,"pending",key,fileName,CONTENT_TYPE,now).run();
  return await env.DB.prepare("SELECT * FROM report_archives WHERE report_id=? LIMIT 1").bind(id).first<ArchiveRow>();
}

export async function archiveClosedMonth(env:Env,now=new Date()){
  if(!env.REPORT_ARCHIVES)throw new Error("R2 binding REPORT_ARCHIVES غير موجود");
  const timezone=String(env.APP_TIMEZONE||"Asia/Damascus"),period=previousMonthPeriod(now,timezone),id=`attendance_period_${period.from}`,key=archiveKey(period);
  const existing=await claimArchive(env,id,period.from,period.to,key);
  if(existing?.status==="LOCKED"||existing?.status==="DELETED")return{ok:true,archived:false,reason:existing.status==="LOCKED"?"already_locked":"deleted_by_admin",id,key,period};
  const report=await buildProfessionalAttendanceReport(env,period.from,period.to);
  const snapshotHash=await sha256Hex(jsonBytes({from:report.from,to:report.to,rows:report.rows,reportVersion:report.reportVersion}));
  const bytes=new Uint8Array(makeWorkbook(report)),hash=await sha256Hex(bytes),fileName=key.split("/").pop()||key;
  await env.REPORT_ARCHIVES.put(key,bytes,{httpMetadata:{contentType:CONTENT_TYPE,cacheControl:"private, max-age=31536000, immutable"},customMetadata:{reportId:id,reportType:"attendance_period",periodFrom:period.from,periodTo:period.to,reportVersion:report.reportVersion,archiveVersion:ARCHIVE_VERSION,sha256:hash,dataSnapshotHash:snapshotHash}});
  const head=await env.REPORT_ARCHIVES.head(key); if(!head||head.size!==bytes.byteLength||head.customMetadata?.sha256!==hash)throw new Error("فشل التحقق من ملف الأرشيف في R2");
  const verifiedAt=new Date().toISOString();
  await env.DB.prepare("UPDATE report_archives SET generated_at=?,report_version=?,data_snapshot_hash=?,status='LOCKED',file_key=?,file_name=?,file_size=?,mime_type=?,file_sha256=?,locked_at=?,locked_by='system' WHERE report_id=?").bind(report.generatedAt,report.reportVersion,snapshotHash,key,fileName,bytes.byteLength,CONTENT_TYPE,hash,verifiedAt,id).run();
  return{ok:true,archived:true,id,key,size:bytes.byteLength,sha256:hash,period};
}
export async function listReportArchives(env:Env,limit=25){const safeLimit=Math.min(100,Math.max(1,Math.floor(limit)));const result=await env.DB.prepare("SELECT report_id,report_type,period_from,period_to,employee_id,generated_at,generated_by,generated_by_name,report_version,data_snapshot_hash,status,file_key,file_name,file_size,mime_type,file_sha256,created_at,locked_at,locked_by,revision FROM report_archives WHERE status='LOCKED' ORDER BY period_from DESC LIMIT ?").bind(safeLimit).all<ArchiveRow>();return result.results||[];}
export async function getReportArchive(env:Env,id:string){return await env.DB.prepare("SELECT * FROM report_archives WHERE report_id=? AND status='LOCKED' LIMIT 1").bind(id).first<ArchiveRow>();}
export async function deleteReportArchive(env:Env,id:string){
  if(!env.REPORT_ARCHIVES)throw new Error("R2 binding REPORT_ARCHIVES غير موجود");
  const archive=await getReportArchive(env,id);
  if(!archive)return{ok:false,reason:"not_found" as const};
  await env.REPORT_ARCHIVES.delete(archive.file_key);
  const remaining=await env.REPORT_ARCHIVES.head(archive.file_key);
  if(remaining)throw new Error("تعذر حذف ملف الأرشيف من R2");
  await env.DB.prepare("UPDATE report_archives SET status='DELETED' WHERE report_id=? AND status='LOCKED'").bind(id).run();
  return{ok:true,deleted:true,reportId:id,fileKey:archive.file_key};
}
