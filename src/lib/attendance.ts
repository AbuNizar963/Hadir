import { addAttendance, findEmployeeByJobNumber, getAttendance, getEmployees, getSettings, saveEmployees } from "@/lib/storage";
import { createBackendAttendance, getBackendEmployeeLocation, getBackendEmployeeProfile, getBackendSettings, backendEnabled } from "@/lib/backend";
import { getDeviceId, getClientIpPlaceholder } from "@/lib/device";
import { haversineMeters, isValidGeoPosition, isLikelyMockedPosition, type GeoPosition } from "@/lib/geo";
import type { AttendanceRecord, Employee } from "@/types";
import { log } from "@/lib/audit";
import { getActiveWorkPeriod, getEmployeeWorkPeriod } from "@/lib/schedule";

export interface RecordArgs { jobNumber: string; type: "check-in" | "check-out"; position: GeoPosition; qrCode: string; }
export interface RecordResult { ok: boolean; reason?: string; record?: AttendanceRecord; distance?: number; lateMinutes?: number; earlyMinutes?: number; timeNote?: string; }

function parseTime(value: string | undefined, fallback = "09:00"): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || fallback).trim());
  if (!match) return parseTime(fallback, "00:00");
  return { hours: Math.min(23, Math.max(0, Number(match[1]))), minutes: Math.min(59, Math.max(0, Number(match[2]))) };
}
function formatMinutesToText(totalMinutes: number): string { const safe=Math.max(0,Math.round(totalMinutes)); const hours=Math.floor(safe/60); const minutes=safe%60; if(hours&&minutes)return `${hours} ساعة و ${minutes} دقيقة`; if(hours)return `${hours} ساعة`; return `${minutes} دقيقة`; }
function recordsForPeriod(employeeId: string, periodStart: Date | null, periodEnd: Date | null): AttendanceRecord[] {
  const all=getAttendance().filter((record)=>record.employeeId===employeeId);
  if(!periodStart) return all;
  return all.filter((record)=>{const t=new Date(record.timestamp).getTime(); return t>=periodStart.getTime() && (!periodEnd || t<=periodEnd.getTime()+60_000);}).sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
}
export function todayRecords(employeeId: string): AttendanceRecord[] {
  const employee=getEmployees().find((item)=>item.id===employeeId);
  if(!employee) return getAttendance().filter((r)=>r.employeeId===employeeId);
  const period=getActiveWorkPeriod(employee,new Date());
  return recordsForPeriod(employeeId,period.start,period.end);
}

export async function recordAttendance(args: RecordArgs): Promise<RecordResult> {
  let settings=getSettings();
  if(backendEnabled){try{const cloud=await getBackendSettings();settings={...settings,...cloud,adminAccounts:Array.isArray(cloud.adminAccounts)?cloud.adminAccounts:settings.adminAccounts};}catch(error){console.warn("تعذر تحميل إعدادات الحضور من Cloudflare D1:",error);}}

  let employee: Employee | null = null;
  if(backendEnabled){try{employee=await getBackendEmployeeProfile();if(String(employee.jobNumber).trim()!==String(args.jobNumber).trim())return{ok:false,reason:"جلسة الموظف لا تطابق الرقم الوظيفي الحالي. يرجى تسجيل الدخول مرة أخرى."};}catch(error){return{ok:false,reason:error instanceof Error?error.message:"تعذر التحقق من جلسة الموظف"};}}
  else employee=findEmployeeByJobNumber(args.jobNumber);

  if(!employee)return{ok:false,reason:"الموظف غير موجود"};
  if(employee.status!=="active")return{ok:false,reason:"الحساب موقوف"};
  if(!isValidGeoPosition(args.position))return{ok:false,reason:"تعذر التحقق من موقعك. يرجى إعادة محاولة تحديد الموقع."};

  const now=new Date();
  const currentPeriod=getEmployeeWorkPeriod(employee,now);
  const allEmployeeRecords=getAttendance().filter((r)=>r.employeeId===employee!.id).sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
  const last=allEmployeeRecords[0];
  const openSession=last?.type==="check-in";

  // Check-in belongs to a new scheduled work period. Check-out belongs to the open session,
  // which may cross midnight and may therefore be outside today's calendar date.
  if(args.type==="check-in"){
    if(!currentPeriod.isWorkDay || !currentPeriod.start || !currentPeriod.end){return{ok:false,reason:`لا يوجد دوام للموظف الآن: ${currentPeriod.label}${currentPeriod.detail?` · ${currentPeriod.detail}`:""}`};}
    const periodRecords=recordsForPeriod(employee.id,currentPeriod.start,currentPeriod.end);
    if(periodRecords.some((r)=>r.type==="check-in"))return{ok:false,reason:"تم تسجيل الحضور مسبقًا لهذه الفترة"};
  }else if(!openSession){return{ok:false,reason:"لا يمكن تسجيل الانصراف قبل تسجيل الحضور"};}

  const deviceId=getDeviceId();
  if(!employee.deviceId){const employees=getEmployees();const index=employees.findIndex((item)=>item.id===employee!.id);if(index>=0){employees[index]={...employees[index],deviceId};saveEmployees(employees);}}
  else if(employee.deviceId!==deviceId){return{ok:false,reason:"الجهاز الحالي غير موثّق لهذا الحساب. يرجى استخدام الجهاز المسجل."};}

  const submittedQr=args.qrCode.trim(); const expectedQr=(settings.qrCode||"").trim();
  if(!submittedQr||!expectedQr||submittedQr!==expectedQr)return{ok:false,reason:"رمز QR غير صحيح أو لا يخص موقع العمل"};
  const mockCheck=await isLikelyMockedPosition(args.position); if(mockCheck.mocked)return{ok:false,reason:"تعذّر التحقق من موقعك. يرجى تعطيل أدوات تغيير الموقع."};

  let targetLat=Number(settings.workSiteLat),targetLng=Number(settings.workSiteLng),targetRadius=Number(settings.radiusMeters),targetLocationId=String(employee.locationId||"main");
  if(backendEnabled){try{const remote=await getBackendEmployeeLocation();targetLat=Number(remote.location.lat);targetLng=Number(remote.location.lng);targetRadius=Number(remote.location.radiusMeters);targetLocationId=String(remote.location.id||"main");}catch(error){return{ok:false,reason:`تعذر التحقق من موقع العمل من D1: ${error instanceof Error?error.message:"خطأ غير معروف"}`};}}
  else {const assigned=settings.locations?.find((location)=>location.id===employee!.locationId);targetLat=Number(assigned?.lat??settings.workSiteLat);targetLng=Number(assigned?.lng??settings.workSiteLng);targetRadius=Number(assigned?.radiusMeters??settings.radiusMeters);targetLocationId=String(assigned?.id??employee.locationId??"main");}
  if(!Number.isFinite(targetLat)||!Number.isFinite(targetLng)||!Number.isFinite(targetRadius)||targetRadius<=0)return{ok:false,reason:"إعدادات موقع العمل غير صالحة. يرجى مراجعة موقع العمل في لوحة الإدارة."};
  const distance=haversineMeters(args.position,{lat:targetLat,lng:targetLng});
  if(!Number.isFinite(distance)||distance>targetRadius)return{ok:false,reason:Number.isFinite(distance)?`أنت خارج نطاق مقر العمل. المسافة الحالية: ${distance} م (الحد المسموح: ${targetRadius} م)`:"تعذر التحقق من موقعك." ,...(Number.isFinite(distance)?{distance}:{})};

  const periodForTiming=args.type==="check-out"&&openSession&&last?getActiveWorkPeriod(employee,now):currentPeriod;
  const start=periodForTiming.start;
  const end=periodForTiming.end;
  const grace=Math.max(0,employee.gracePeriodMinutes??settings.lateGraceMinutes??10);
  let lateMinutes=0,earlyMinutes=0,timeNote="";
  if(args.type==="check-in"&&start){const diff=Math.round((now.getTime()-start.getTime())/60000);if(diff>grace){lateMinutes=diff;timeNote=`تم تسجيل الحضور متأخراً بمقدار ${formatMinutesToText(lateMinutes)}`;}else timeNote="تم تسجيل الحضور ضمن الوقت المسموح";}
  if(args.type==="check-out"&&end){const diff=Math.round((end.getTime()-now.getTime())/60000);if(diff>0){earlyMinutes=diff;timeNote=`تم تسجيل الانصراف مبكراً بمقدار ${formatMinutesToText(earlyMinutes)}`;}else timeNote="تم تسجيل الانصراف في الوقت المحدد أو بعده";}

  const record:AttendanceRecord={id:crypto.randomUUID(),employeeId:employee.id,jobNumber:employee.jobNumber,employeeName:employee.name,type:args.type,timestamp:now.toISOString(),lat:args.position.lat,lng:args.position.lng,distanceMeters:distance,deviceId,ip:getClientIpPlaceholder(),qrCode:submittedQr,locationId:targetLocationId};
  if(backendEnabled){try{const remote=await createBackendAttendance({employeeId:employee.id,jobNumber:employee.jobNumber,employeeName:employee.name,type:args.type,timestamp:record.timestamp,lat:record.lat,lng:record.lng,distanceMeters:record.distanceMeters,deviceId:record.deviceId,qrCode:record.qrCode,locationId:record.locationId});if(!remote?.ok)return{ok:false,reason:"تعذر حفظ تسجيل الحضور في D1."};if(remote.record)Object.assign(record,remote.record);}catch(error){const reason=error instanceof Error?error.message:"تعذر حفظ تسجيل الحضور في D1";log({employeeId:employee.id,jobNumber:employee.jobNumber,actorName:employee.name,action:args.type,result:"rejected",reason:`فشل حفظ الحضور في D1: ${reason}`,lat:record.lat,lng:record.lng,distanceMeters:distance});return{ok:false,reason:`تعذر حفظ تسجيل الحضور في D1: ${reason}`};}}
  addAttendance(record);
  log({employeeId:employee.id,jobNumber:employee.jobNumber,actorName:employee.name,action:args.type,result:"success",reason:timeNote,lat:record.lat,lng:record.lng,distanceMeters:distance});
  return{ok:true,record,distance,lateMinutes,earlyMinutes,timeNote};
}
