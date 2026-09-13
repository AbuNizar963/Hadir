import { getAttendanceShift } from "./attendance-period";
import { submitAttendanceThroughCentralEngine } from "./attendance-engine-central";

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

  const result = await submitAttendanceThroughCentralEngine(
    env,
    employeeId,
    "check-in",
    `CENTRAL_ADMIN:${role}`,
    "تحضير مباشر من الإدارة"
  );
  if (result.error) return json({ error: result.error }, 409);
  if (!result.response) return json({ error: "تعذر الوصول إلى محرك الحضور المركزي" }, 500);
  const payload = await result.response.json().catch(() => ({}));
  return json(payload, result.response.status);
}
