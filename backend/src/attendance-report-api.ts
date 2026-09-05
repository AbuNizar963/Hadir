type Env = { DB: D1Database; APP_ORIGIN?: string };
import { handleDailyStatus } from "./daily-status-api";

const TZ = "Asia/Damascus";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 93;
const CORS = (origin: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
  vary: "Origin",
});
const json = (data: unknown, status: number, origin: string) => new Response(JSON.stringify(data), { status, headers: CORS(origin) });
const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
const addDays = (day: string, n: number) => new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round(dayNumber(to) - dayNumber(from));
const minutesBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
};

export async function handleAttendanceReport(req: Request, env: Env, actor: any) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const origin = requestOrigin || String(env.APP_ORIGIN || "*").split(",")[0].trim() || "*";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "GET") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const employeeId = String(url.searchParams.get("employeeId") || "").trim();
  if (!DAY_RE.test(from) || !DAY_RE.test(to) || daysBetween(from, to) < 0) return json({ error: "الفترة الزمنية غير صالحة" }, 400, origin);
  const dayCount = daysBetween(from, to) + 1;
  if (dayCount > MAX_DAYS) return json({ error: `الفترة تتجاوز الحد المسموح (${MAX_DAYS} يومًا)`, maxDays: MAX_DAYS }, 400, origin);

  try {
    const rows: any[] = [];
    const summary = { employees: 0, employeeDays: 0, present: 0, late: 0, absent: 0, leave: 0, permission: 0, rest: 0, notStarted: 0, invalid: 0, open: 0, missingCheckIn: 0, missingCheckOut: 0, workedMinutes: 0, expectedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 };
    const seenEmployees = new Set<string>();

    for (let offset = 0; offset < dayCount; offset += 1) {
      const day = addDays(from, offset);
      const dayRequest = new Request(`${new URL(req.url).origin}/api/manager/daily-status?date=${encodeURIComponent(day)}`, { method: "GET", headers: req.headers });
      const dailyResponse = await handleDailyStatus(dayRequest, env, actor);
      if (!dailyResponse.ok) {
        const payload = await dailyResponse.json().catch(() => ({ error: "تعذر حساب حالة الدوام" }));
        return json({ error: "تعذر بناء التقرير من محرك حالة الدوام", day, detail: payload }, 500, origin);
      }
      const daily = await dailyResponse.json() as any;
      const dailyEmployees = Array.isArray(daily.employees) ? daily.employees : [];
      const dayStart = `${day}T00:00:00.000Z`;
      const nextDay = addDays(day, 1);
      const dayEnd = `${nextDay}T00:00:00.000Z`;
      const eventQuery = employeeId
        ? await env.DB.prepare("SELECT id,employee_id AS employeeId,job_number AS jobNumber,employee_name AS employeeName,type,timestamp,lat,lng,distance_meters AS distanceMeters,device_id AS deviceId,ip,qr_code AS qrCode,location_id AS locationId FROM attendance WHERE timestamp>=? AND timestamp<? AND employee_id=? ORDER BY timestamp ASC").bind(dayStart, dayEnd, employeeId).all<any>()
        : await env.DB.prepare("SELECT id,employee_id AS employeeId,job_number AS jobNumber,employee_name AS employeeName,type,timestamp,lat,lng,distance_meters AS distanceMeters,device_id AS deviceId,ip,qr_code AS qrCode,location_id AS locationId FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC").bind(dayStart, dayEnd).all<any>();
      const events = eventQuery.results || [];
      const eventsByEmployee = new Map<string, any[]>();
      for (const event of events) {
        const id = String(event.employeeId || "");
        if (!id) continue;
        const list = eventsByEmployee.get(id) || [];
        list.push(event);
        eventsByEmployee.set(id, list);
      }

      for (const dailyRow of dailyEmployees) {
        const id = String(dailyRow.employeeId || "");
        if (!id || (employeeId && id !== employeeId)) continue;
        seenEmployees.add(id);
        const eventsForEmployee = eventsByEmployee.get(id) || [];
        const checkIns = eventsForEmployee.filter((e) => String(e.type) === "check-in");
        const checkOuts = eventsForEmployee.filter((e) => String(e.type) === "check-out");
        const checkInAt = String(dailyRow.checkInAt || checkIns[0]?.timestamp || "") || null;
        const checkOutAt = String(dailyRow.checkOutAt || checkOuts[checkOuts.length - 1]?.timestamp || "") || null;
        const workedMinutes = minutesBetween(checkInAt, checkOutAt);
        const expectedMinutes = minutesBetween(String(dailyRow.scheduledStart || "") || null, String(dailyRow.scheduledEnd || "") || null);
        const lateMinutes = dailyRow.status === "LATE" && dailyRow.scheduledStart && checkInAt ? Math.max(0, minutesBetween(dailyRow.scheduledStart, checkInAt) || 0) : 0;
        const earlyLeaveMinutes = dailyRow.scheduledEnd && checkOutAt ? Math.max(0, minutesBetween(checkOutAt, dailyRow.scheduledEnd) || 0) : 0;
        const overtimeMinutes = dailyRow.scheduledEnd && checkOutAt ? Math.max(0, minutesBetween(dailyRow.scheduledEnd, checkOutAt) || 0) : 0;
        const open = Boolean(checkInAt && !checkOutAt);
        const missingCheckIn = Boolean(checkOutAt && !checkInAt);
        const missingCheckOut = open;
        let exceptionCode: string | null = null;
        if (missingCheckIn) exceptionCode = "CHECKOUT_WITHOUT_CHECKIN";
        else if (missingCheckOut) exceptionCode = "MISSING_CHECKOUT";
        else if (dailyRow.status === "ABSENT") exceptionCode = "ABSENT_NO_APPROVED_REASON";
        else if (lateMinutes > 0) exceptionCode = "LATE_ARRIVAL";
        else if (earlyLeaveMinutes > 0) exceptionCode = "EARLY_LEAVE";
        else if (overtimeMinutes > 0) exceptionCode = "OVERTIME";

        const row = {
          attendanceDay: day,
          employeeId: id,
          employeeName: String(dailyRow.employeeName || ""),
          jobNumber: String(dailyRow.jobNumber || ""),
          status: String(dailyRow.status || "INVALID"),
          scheduleType: String(dailyRow.scheduleType || "ADMIN"),
          scheduledStart: dailyRow.scheduledStart || null,
          scheduledEnd: dailyRow.scheduledEnd || null,
          expectedMinutes,
          checkInAt,
          checkOutAt,
          workedMinutes,
          lateMinutes,
          earlyLeaveMinutes,
          overtimeMinutes,
          open,
          exceptionCode,
          attendanceEventIds: eventsForEmployee.map((event) => String(event.id)),
          attendanceEventCount: eventsForEmployee.length,
          attendanceEvents: eventsForEmployee,
          calculationSource: "attendance+requests+schedule+daily_attendance_status",
          calculationVersion: "report-v1",
          timezone: TZ,
        };
        rows.push(row);
        summary.employeeDays += 1;
        summary.present += row.status === "PRESENT" ? 1 : 0;
        summary.late += row.status === "LATE" ? 1 : 0;
        summary.absent += row.status === "ABSENT" ? 1 : 0;
        summary.leave += row.status === "LEAVE" ? 1 : 0;
        summary.permission += row.status === "PERMISSION" ? 1 : 0;
        summary.rest += row.status === "REST" ? 1 : 0;
        summary.notStarted += row.status === "NOT_STARTED" ? 1 : 0;
        summary.invalid += row.status === "INVALID" ? 1 : 0;
        summary.open += open ? 1 : 0;
        summary.missingCheckIn += missingCheckIn ? 1 : 0;
        summary.missingCheckOut += missingCheckOut ? 1 : 0;
        summary.workedMinutes += workedMinutes || 0;
        summary.expectedMinutes += expectedMinutes || 0;
        summary.lateMinutes += lateMinutes;
        summary.earlyLeaveMinutes += earlyLeaveMinutes;
        summary.overtimeMinutes += overtimeMinutes;
      }
    }

    summary.employees = seenEmployees.size;
    const workdays = rows.filter((row) => ["PRESENT", "LATE", "ABSENT", "PERMISSION", "OPEN"].includes(row.status));
    const attendanceRateDenominator = rows.filter((row) => ["PRESENT", "LATE", "ABSENT"].includes(row.status)).length;
    const attendanceRate = attendanceRateDenominator ? Number(((summary.present + summary.late) / attendanceRateDenominator * 100).toFixed(2)) : 0;
    const punctualityDenominator = summary.present + summary.late;
    const punctualityRate = punctualityDenominator ? Number((summary.present / punctualityDenominator * 100).toFixed(2)) : 0;

    return json({
      ok: true,
      reportVersion: "1.0",
      generatedAt: new Date().toISOString(),
      timezone: TZ,
      from,
      to,
      days: dayCount,
      filters: { employeeId: employeeId || null },
      summary: { ...summary, attendanceRate, punctualityRate },
      rows,
      integrity: {
        sourceOfTruth: "attendance",
        derivedStatus: "daily_attendance_status",
        noRawAttendanceMutation: true,
        periodScoped: true,
        maxDays: MAX_DAYS,
        drillDownAvailable: true,
      },
    }, 200, origin);
  } catch (error) {
    console.error("attendance report failed", error);
    return json({ error: "تعذر بناء تقرير الحضور من بيانات D1" }, 500, origin);
  }
}
