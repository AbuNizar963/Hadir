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

export async function handleProfessionalAttendanceReport(req: Request, env: Env, actor: any) {
  const url = new URL(req.url);
  const requestOrigin = String(req.headers.get("origin") || "").trim().replace(/\/$/, "");
  const origin = requestOrigin || String(env.APP_ORIGINS || env.APP_ORIGIN || "*").split(",")[0].trim() || "*";

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "GET") return json({ error: "الطريقة غير مدعومة" }, 405, origin);
  if (!actor || !["owner", "manager", "supervisor"].includes(String(actor.role))) {
    return json({ error: "غير مصرح" }, 403, origin);
  }

  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();
  const employeeId = String(url.searchParams.get("employeeId") || "").trim() || undefined;

  if (!DAY_RE.test(from) || !DAY_RE.test(to)) return json({ error: "الفترة الزمنية غير صالحة" }, 400, origin);

  try {
    const report = await buildProfessionalAttendanceReport(env, from, to, employeeId);
    return json(report, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بناء التقرير";
    console.error("professional attendance report failed", error);
    return json({ error: message }, 400, origin);
  }
}
