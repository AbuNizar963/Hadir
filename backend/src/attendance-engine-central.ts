import { handleEmployeeAttendance as executeCanonicalAttendance } from "./attendance-engine-commands";

type Env = { DB: D1Database };

/**
 * Single application-level gateway for attendance mutations.
 *
 * HTTP employee attendance, VIP/automatic attendance and administrative
 * attendance all enter this module. Only the canonical attendance engine is
 * allowed to persist the attendance row.
 */
function executeCentralAttendance(
  req: Request,
  env: Env,
  actor: any,
  origin: string,
  trustedTimestamp?: string,
  internal = false,
) {
  return executeCanonicalAttendance(req, env, actor, origin, trustedTimestamp, internal);
}

export async function handleAttendanceThroughCentralEngine(
  req: Request,
  env: Env,
  actor: any,
  origin: string,
) {
  // Public HTTP attendance never receives a trusted timestamp. Trusted event
  // times are available only to internal application flows below.
  return executeCentralAttendance(req, env, actor, origin, undefined, false);
}

/**
 * Internal write helper used by automatic/VIP and administrative flows.
 * The internal trust boundary is private to this module; callers cannot
 * supply the internal flag through an HTTP request or client-controlled data.
 */
export async function submitAttendanceThroughCentralEngine(
  env: Env,
  employeeId: string,
  type: "check-in" | "check-out",
  deviceId: string,
  reason = "",
  timestamp?: string,
) {
  const employee = await env.DB.prepare(
    "SELECT id,location_id AS locationId FROM employees WHERE id=? AND status='active' LIMIT 1"
  ).bind(employeeId).first<any>();
  if (!employee) return { response: null, error: "الموظف غير موجود أو موقوف" };

  const location = await env.DB.prepare(
    "SELECT id,lat,lng FROM locations WHERE id=? LIMIT 1"
  ).bind(employee.locationId || "main").first<any>()
    || await env.DB.prepare("SELECT id,lat,lng FROM locations ORDER BY name LIMIT 1").first<any>();
  if (!location) return { response: null, error: "لا يوجد موقع عمل محفوظ" };

  const request = new Request("https://hadir.local/api/attendance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-device-id": deviceId,
      "x-attendance-source": reason || "central-engine",
    },
    body: JSON.stringify({
      type,
      lat: Number(location.lat),
      lng: Number(location.lng),
      qrCode: "CENTRAL_ENGINE",
      deviceId,
      ...(timestamp ? { timestamp } : {}),
    }),
  });

  const response = await executeCentralAttendance(
    request,
    env,
    { id: employeeId, role: "staff", name: "المحرك المركزي" },
    "*",
    timestamp,
    true,
  );
  return { response, error: null };
}
