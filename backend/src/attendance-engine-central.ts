import { handleEmployeeAttendance } from "./attendance-engine-commands";

type Env = { DB: D1Database; APP_TIMEZONE?: string };

/**
 * The single write gateway for every attendance action.
 * Manual staff attendance, VIP/automatic attendance and administrative
 * attendance must all enter the canonical attendance engine through here.
 */
export async function submitAttendanceThroughCentralEngine(
  env: Env,
  employeeId: string,
  type: "check-in" | "check-out",
  deviceId: string,
  reason = ""
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
    }),
  });

  const response = await handleEmployeeAttendance(
    request,
    env,
    { id: employeeId, role: "staff", name: "المحرك المركزي" },
    "*"
  );
  return { response, error: null };
}
