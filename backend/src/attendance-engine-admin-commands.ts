import { getAttendanceShift } from "./attendance-period";
import { refreshCanonicalStatus } from "./attendance-engine-commands";
import { refreshProfessionalAttendanceFact } from "./professional-attendance-fact-builder";

type Env = { DB: D1Database; APP_TIMEZONE?: string };

type Actor = { id?: string; name?: string; role?: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export async function handleAdministrativeAttendancePreparation(request: Request, env: Env, actor: Actor | null) {
  const role = String(actor?.role || "").toLowerCase();
  if (!actor || !["owner", "manager"].includes(role)) return json({ error: "المالك أو المدير فقط يستطيعان التحضير المباشر" }, 403);

  const body = await request.json().catch(() => ({})) as any;
  const employeeId = String(body.employeeId || "").trim();
  const type = String(body.type || "check-in");
  if (!employeeId || type !== "check-in") return json({ error: "بيانات التحضير المباشر غير صحيحة" }, 400);

  const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if (!employee || employee.status !== "active") return json({ error: "الموظف غير موجود أو موقوف" }, 404);

  const now = new Date();
  const shift = getAttendanceShift(employee, now, env.APP_TIMEZONE || "Asia/Damascus");
  if (!shift.isWorkDay || now.getTime() < shift.start.getTime() || now.getTime() > shift.end.getTime() + 60000) return json({ error: "لا توجد مناوبة فعالة لهذا الموظف الآن" }, 409);

  const rows = await env.DB.prepare("SELECT id,type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<=? ORDER BY timestamp DESC LIMIT 200").bind(employee.id, shift.start.toISOString(), new Date(Math.min(shift.end.getTime() + 60000, now.getTime() + 5000)).toISOString()).all<any>();
  const valid = (rows.results || []).filter((row: any) => {
    const timestamp = Date.parse(String(row.timestamp || ""));
    return Number.isFinite(timestamp) && timestamp >= shift.start.getTime() && timestamp <= now.getTime() + 5000;
  });
  if (valid.some((row: any) => String(row.type) === "check-in")) return json({ error: "الموظف مسجل حضور بالفعل في هذه المناوبة" }, 409);

  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const deviceId = `ADMIN_DIRECT:${role === "manager" ? "المدير" : "المالك"}`;
  await env.DB.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, employee.id, employee.jobNumber, employee.name, "check-in", timestamp, null, null, null, deviceId, "system", "DIRECT_ADMIN", null).run();
  await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), employee.id, employee.jobNumber, actor.name || (role === "manager" ? "المدير" : "المالك"), "check-in", "success", "تحضير مباشر من الإدارة", timestamp, deviceId, "system", null, null, null).run().catch(() => undefined);

  const staffActor = { ...actor, id: employee.id, role: "staff" };
  await refreshCanonicalStatus(env, staffActor, now);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  await refreshProfessionalAttendanceFact(env, day, staffActor, employee.id);

  return json({ ok: true, record: { id, employeeId: employee.id, jobNumber: employee.jobNumber, employeeName: employee.name, type: "check-in", timestamp, deviceId, ip: "system", qrCode: "DIRECT_ADMIN", locationId: null } }, 201);
}
