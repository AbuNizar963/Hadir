type Env = { DB: D1Database; APP_TIMEZONE?: string };

const DAY_MS = 86_400_000;
const id = () => crypto.randomUUID();

function dateKey(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`,
    weekday: weekdays[get("weekday")] ?? 0,
  };
}

function minutes(value: string | null | undefined) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const result = Number(m[1]) * 60 + Number(m[2]);
  return result >= 0 && result < 1440 ? result : null;
}

function workDays(employee: any) {
  try {
    const parsed = JSON.parse(String(employee.workDaysJson || "[]"));
    if (Array.isArray(parsed)) {
      const values = parsed.filter((n) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6).map(Number);
      if (values.length) return [...new Set(values)];
    }
  } catch {}
  return [0, 1, 2, 3, 4];
}

function activeWorkday(employee: any, date: Date, tz: string) {
  const kind = String(employee.scheduleType || "ADMIN").trim().toUpperCase();
  const parts = localParts(date, tz);
  if (kind !== "ROTATION") return workDays(employee).includes(parts.weekday);

  const start = String(employee.rotationStartDate || "").slice(0, 10);
  const on = Math.max(1, Math.floor(Number(employee.rotationDaysOn ?? 4)));
  const off = Math.max(0, Math.floor(Number(employee.rotationDaysOff ?? 4)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${parts.date}T00:00:00Z`);
  const elapsed = Math.floor((b - a) / DAY_MS);
  if (elapsed < 0) return false;
  return (elapsed % (on + off)) < on;
}

function localDateTime(dateValue: string, timeValue: string, tz: string) {
  const [y, m, d] = dateValue.split("-").map(Number);
  const [hh, mm] = timeValue.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 4; i++) {
    const actual = localParts(new Date(guess), tz);
    const wanted = Number(dateValue.replace(/-/g, ""));
    const actualDay = Number(actual.date.replace(/-/g, ""));
    const diff = (actualDay - wanted) * 1440 + (Number(actual.time.slice(0, 2)) * 60 + Number(actual.time.slice(3)) - hh * 60 - mm);
    if (Math.abs(diff) < 1) break;
    guess -= diff * 60000;
  }
  return new Date(guess);
}

async function locationFor(db: D1Database, employee: any) {
  const row = await db.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations WHERE id=? LIMIT 1").bind(employee.locationId || "main").first<any>();
  return row || await db.prepare("SELECT id,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name LIMIT 1").first<any>();
}

async function insertAutoAttendance(db: D1Database, employee: any, type: "check-in" | "check-out", timestamp: string) {
  const loc = await locationFor(db, employee);
  if (!loc) return null;
  const attendanceId = id();
  const deviceId = "AUTO_VIP";
  await db.prepare("INSERT INTO attendance(id,employee_id,job_number,employee_name,type,timestamp,lat,lng,distance_meters,device_id,ip,qr_code,location_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(attendanceId, employee.id, employee.jobNumber, employee.name, type, timestamp, Number(loc.lat), Number(loc.lng), 0, deviceId, "system", "AUTO_VIP", loc.id).run();
  await db.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip,lat,lng,distance_meters) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id(), employee.id, employee.jobNumber, "النظام", type, "success", type === "check-in" ? "تحضير VIP تلقائي حسب جدول الدوام" : "انصراف VIP تلقائي حسب جدول الدوام", timestamp, deviceId, "system", Number(loc.lat), Number(loc.lng), 0).run().catch(() => undefined);
  return { id: attendanceId, employeeId: employee.id, employeeName: employee.name, type, timestamp };
}

export async function runAutomaticVip(env: Env) {
  const configured = await env.DB.prepare("SELECT value FROM settings WHERE key='timezone' LIMIT 1").first<any>().catch(() => null);
  let tz = String(env.APP_TIMEZONE || "Asia/Damascus");
  try {
    const value = JSON.parse(String(configured?.value || ""));
    if (typeof value === "string" && value.trim()) tz = value.trim();
  } catch {
    if (String(configured?.value || "").trim()) tz = String(configured.value).trim();
  }

  const now = new Date();
  const today = dateKey(now, tz);
  const rows = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson,is_vip AS isVip FROM employees WHERE status='active' AND is_vip=1").all<any>();
  const results: any[] = [];

  for (const employee of (rows.results || []) as any[]) {
    const request = await env.DB.prepare("SELECT type,start_date AS startDate,end_date AS endDate FROM requests WHERE employee_id=? AND status IN ('approved','confirmed') AND type IN ('leave','permission') AND COALESCE(start_date,substr(created_at,1,10))<=? AND COALESCE(end_date,COALESCE(start_date,substr(created_at,1,10)))>=? ORDER BY created_at DESC LIMIT 1")
      .bind(employee.id, today, today).first<any>().catch(() => null);
    if (request) continue;
    if (!activeWorkday(employee, now, tz)) continue;

    const start = minutes(employee.workStartTime);
    const end = minutes(employee.workEndTime);
    if (start == null || end == null) continue;

    const parts = localParts(now, tz);
    const startAt = localDateTime(parts.date, employee.workStartTime, tz);
    let endDate = parts.date;
    if (end <= start) endDate = dateKey(new Date(now.getTime() + DAY_MS), tz);
    const endAt = localDateTime(endDate, employee.workEndTime, tz);

    const shiftRows = await env.DB.prepare("SELECT type,timestamp FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<? ORDER BY timestamp ASC")
      .bind(employee.id, startAt.toISOString(), new Date(endAt.getTime() + 60000).toISOString()).all<any>();
    const rowsForShift = (shiftRows.results || []) as any[];
    let hasIn = rowsForShift.some((r) => r.type === "check-in");
    const hasOut = rowsForShift.some((r) => r.type === "check-out");

    if (now >= startAt && !hasIn) {
      const record = await insertAutoAttendance(env.DB, employee, "check-in", startAt.toISOString());
      if (record) { results.push(record); hasIn = true; }
    }

    // Checkout must be based on the latest check-in within this shift, not the employee's global latest event.
    // A later event from another shift/date must not prevent the scheduled VIP checkout.
    if (now >= endAt && !hasOut) {
      const latestShiftIn = [...rowsForShift]
        .filter((r) => r.type === "check-in" && Date.parse(String(r.timestamp)) <= endAt.getTime())
        .sort((a, b) => Date.parse(String(b.timestamp)) - Date.parse(String(a.timestamp)))[0];
      if (latestShiftIn) {
        const record = await insertAutoAttendance(env.DB, employee, "check-out", endAt.toISOString());
        if (record) results.push(record);
      }
    }
  }

  return { ok: true, timezone: tz, processed: rows.results?.length || 0, created: results };
}
