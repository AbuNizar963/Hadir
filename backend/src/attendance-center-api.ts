import { handleDailyStatus } from "./attendance-engine";
import { buildProfessionalAttendanceReport } from "./professional-attendance-report-engine";

type Env = { DB: D1Database; APP_ORIGIN?: string; APP_ORIGINS?: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CORS = (origin: string) => ({
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
  vary: "Origin",
});

const json = (data: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(data), { status, headers: CORS(origin) });

const dayFromRequest = (url: URL) => String(url.searchParams.get("date") || "").trim();
const fromRequest = (url: URL) => String(url.searchParams.get("from") || dayFromRequest(url)).trim();
const toRequest = (url: URL) => String(url.searchParams.get("to") || dayFromRequest(url)).trim();

export async function handleAttendanceCenter(req: Request, env: Env, actor: any) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const origin = requestOrigin || String(env.APP_ORIGINS || env.APP_ORIGIN || "*").split(",")[0].trim() || "*";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "GET") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);

  const date = dayFromRequest(url);
  const from = fromRequest(url);
  const to = toRequest(url);
  if (!DAY_RE.test(date) || !DAY_RE.test(from) || !DAY_RE.test(to)) return json({ error: "التاريخ أو الفترة الزمنية غير صالحة" }, 400, origin);

  const employeeId = String(url.searchParams.get("employeeId") || "").trim() || undefined;

  try {
    const dailyStatus = await handleDailyStatus(
      new Request(`https://internal/api/manager/daily-status?date=${encodeURIComponent(date)}`, {
        method: "GET",
        headers: req.headers,
      }),
      env,
      actor,
      false,
    );
    if (!dailyStatus.ok) {
      const payload = await dailyStatus.json().catch(() => ({ error: "تعذر قراءة مركز الحضور" }));
      return json(payload, dailyStatus.status, origin);
    }

    const report = await buildProfessionalAttendanceReport(env, from, to, employeeId);
    const live = await dailyStatus.json();

    return json({
      ok: true,
      centerVersion: "1.0",
      timezone: "Asia/Damascus",
      date,
      from,
      to,
      attendance: live,
      report,
      integrity: {
        readOnly: true,
        noRawAttendanceMutation: true,
        attendanceSource: "attendance-engine",
        historicalReportSource: "attendance_reporting_facts",
      },
    }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر قراءة مركز الحضور والتقارير";
    console.error("attendance center failed", error);
    return json({ error: message }, 400, origin);
  }
}
