import { handleDailyStatus as computeDailyStatus } from "./attendance-engine";

const TZ = "Asia/Damascus";

type CanonicalRow = {
  employeeId: string;
  status: string;
  scheduleType: string;
  scheduledStart: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  attendanceDay?: string;
};

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeCurrentDay(rows: CanonicalRow[], employees: any[], now: Date) {
  const today = dayKey(now);
  const byId = new Map((employees || []).map((employee: any) => [String(employee.id), employee]));
  return rows.map((row) => {
    if (String(row.scheduleType).toUpperCase() === "ROTATION" || !row.scheduledStart) return row;
    const employee = byId.get(String(row.employeeId));
    if (!employee) return row;
    const grace = Math.max(0, Math.min(180, Number(employee.grace_period_minutes ?? 10)));
    const start = Date.parse(String(row.scheduledStart));
    if (!Number.isFinite(start)) return row;
    if (row.status === "ABSENT" && now.getTime() < start + grace * 60000) {
      return { ...row, status: "NOT_STARTED" };
    }
    if (row.status === "REST" && now.getTime() >= start + grace * 60000 && dayKey(new Date(start)) === today) {
      return { ...row, status: "ABSENT" };
    }
    return row;
  });
}

export async function handleDailyStatus(req: Request, env: any, actor: any, persist = false) {
  const response = await computeDailyStatus(req, env, actor, persist);
  if (response.status !== 200 || req.method !== "GET") return response;
  try {
    const payload = await response.clone().json() as any;
    const day = String(payload?.attendanceDay || "");
    if (day !== dayKey(new Date()) || !Array.isArray(payload?.employees) || payload.employees.length === 0) return response;
    const ids = payload.employees.map((row: any) => String(row.employeeId)).filter(Boolean);
    if (!ids.length) return response;
    const placeholders = ids.map(() => "?").join(",");
    const employees = await env.DB.prepare(`SELECT id,grace_period_minutes FROM employees WHERE id IN (${placeholders})`).bind(...ids).all<any>();
    const before = payload.employees as CanonicalRow[];
    const after = normalizeCurrentDay(before, employees.results || [], new Date());
    if (persist) {
      const changed = after.filter((row, index) => String(row.status) !== String(before[index]?.status));
      if (changed.length) {
        await env.DB.batch(changed.map((row) => env.DB.prepare("UPDATE daily_attendance_status SET status=?,computed_at=? WHERE attendance_day=? AND employee_id=?").bind(row.status, new Date().toISOString(), day, row.employeeId)));
      }
    }
    payload.employees = after;
    payload.counts = payload.employees.reduce((acc: Record<string, number>, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    return response;
  }
}
