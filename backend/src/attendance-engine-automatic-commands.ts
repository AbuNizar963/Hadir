import { dateKey, getAttendanceShift, getAttendanceShiftForDay } from "./attendance-period";
import { refreshProfessionalAttendanceFact } from "./professional-attendance-fact-builder";
import { refreshCanonicalStatus } from "./attendance-engine-commands";

type Env = { DB: D1Database; APP_TIMEZONE?: string };

const id = () => crypto.randomUUID();

function dateKeyLocal(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function operationalShift(employee: any, current: Date, tz: string) {
  const day = dateKeyLocal(current, tz);
  if (String(employee.scheduleType || "").toUpperCase() === "ROTATION") return getAttendanceShiftForDay(employee, day, tz);
  return getAttendanceShift(employee, current, tz);
}

async function locationFor(db: D1Database, employee: any) {
  const row = await db.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations WHERE id=? LIMIT 1").bind(employee.locationId || "main").first<any>();
  return row || (await db.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name LIMIT 1").first<any>());
}

export async function insertAutomaticAttendance(
  db: D1Database,
  employee: any,
  type: "check-in" | "check-out",
  timestamp: string,
  actorName: string,
  reason: string,
) {
  const loc = await locationFor(db, employee);
  if (!loc) return null;
  const deviceId = `ADMIN_DIRECT:${actorName}`;
  const attendanceId = id();
  await db.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(attendanceId, employee.id, employee.jobNumber, employee.name, type, timestamp, Number(loc.lat), Number(loc.lng), 0, deviceId, "system", "AUTO_DIRECT", loc.id)
    .run();
  await db.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id(), employee.id, employee.jobNumber, actorName, type, "success", reason, timestamp, deviceId, "system", Number(loc.lat), Number(loc.lng), 0)
    .run()
    .catch(() => undefined);
  return { id: attendanceId, employeeId: employee.id, employeeName: employee.name, type, timestamp, locationId: loc.id };
}

export async function runAutomaticAttendance(env: Env) {
  const configured = await env.DB.prepare("SELECT value FROM settings WHERE key='timezone' LIMIT 1").first<any>().catch(() => null);
  let tz = String(env.APP_TIMEZONE || "Asia/Damascus");
  try {
    const parsed = JSON.parse(String(configured?.value || ""));
    if (typeof parsed === "string" && parsed.trim()) tz = parsed.trim();
  } catch {
    if (String(configured?.value || "").trim()) tz = String(configured.value).trim();
  }

  const current = new Date();
  const currentDay = dateKeyLocal(current, tz);
  const employees = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees WHERE status='active'").all<any>();
  const results: any[] = [];

  for (const e of (employees.results || []) as any[]) {
    const activeRequest = await env.DB.prepare("SELECT type,start_date AS startDate,end_date AS endDate FROM requests WHERE employee_id=? AND status IN ('approved','confirmed') AND type IN ('leave','permission') AND COALESCE(start_date,substr(created_at,1,10))<=? AND COALESCE(end_date,COALESCE(start_date,substr(created_at,1,10)))>=? ORDER BY created_at DESC LIMIT 1")
      .bind(e.id, currentDay, currentDay).first<any>().catch(() => null);
    if (activeRequest) continue;

    const shift = operationalShift(e, current, tz);
    if (!shift.isWorkDay) continue;

    const existing = await env.DB.prepare("SELECT type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<? ORDER BY timestamp ASC")
      .bind(e.id, shift.start.toISOString(), new Date(shift.end.getTime() + 60000).toISOString()).all<any>();
    const shiftRows = (existing.results || []) as any[];
    let hasShiftIn = shiftRows.some((r: any) => r.type === "check-in");
    const hasShiftOut = shiftRows.some((r: any) => r.type === "check-out");

    if ((e.autoCheckIn || e.isVip) && current >= shift.start && !hasShiftIn) {
      const r = await insertAutomaticAttendance(env.DB, e, "check-in", shift.start.toISOString(), "التلقائي", "تحضير تلقائي حسب بداية المناوبة للموظف VIP/التلقائي");
      if (r) {
        shiftRows.push({ type: r.type, timestamp: r.timestamp });
        hasShiftIn = true;
        results.push(r);
        await refreshProfessionalAttendanceFact(env, currentDay, { id: e.id, role: "staff" }, e.id);
      }
    }

    const latestShiftIn = [...shiftRows]
      .filter((r) => r.type === "check-in" && Date.parse(String(r.timestamp)) <= shift.end.getTime())
      .sort((a, b) => Date.parse(String(b.timestamp)) - Date.parse(String(a.timestamp)))[0];

    if ((e.autoCheckOut || e.isVip) && !hasShiftOut && latestShiftIn && current >= shift.end) {
      const r = await insertAutomaticAttendance(env.DB, e, "check-out", shift.end.toISOString(), "التلقائي", "انصراف تلقائي حسب نهاية المناوبة للموظف VIP/التلقائي");
      if (r) {
        results.push(r);
        await refreshProfessionalAttendanceFact(env, currentDay, { id: e.id, role: "staff" }, e.id);
      }
    }
  }

  if (employees.results?.length) await refreshCanonicalStatus(env, { id: "automation", role: "staff" }, current);
  return { ok: true, timezone: tz, processed: employees.results?.length || 0, created: results };
}
