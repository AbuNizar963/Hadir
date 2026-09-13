type ChallengeEnv = { DB: D1Database; APP_TIMEZONE?: string };

const CHALLENGE_TTL_MS = 60_000;
const CHECKOUT_GRACE_MS = 4 * 60 * 60 * 1000;
const EARTH_RADIUS_METERS = 6_371_000;

function json(data: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "cache-control": "no-store",
    },
  });
}

function coordinate(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(7)) : NaN;
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const lat1 = aLat * Math.PI / 180;
  const lat2 = bLat * Math.PI / 180;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const safeH = Math.min(1, Math.max(0, h));
  return Number((EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(safeH), Math.sqrt(1 - safeH))).toFixed(2));
}

async function ensureAttendanceChallengeSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS attendance_challenges(id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, device_id TEXT NOT NULL, type TEXT NOT NULL, qr_code TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, location_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_challenges_employee_created ON attendance_challenges(employee_id,created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_challenges_expiry ON attendance_challenges(expires_at,used_at)"),
  ]);
}

async function employeeLocation(db: D1Database, employeeId: string) {
  const employee = await db.prepare("SELECT id,location_id AS locationId,status FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if (!employee || String(employee.status) !== "active") return null;
  const rows = await db.prepare("SELECT id,name,lat,lng,radius_meters AS radiusMeters FROM locations ORDER BY name").all<any>();
  const list = rows.results || [];
  const selected = (employee.locationId ? list.find((x: any) => String(x.id) === String(employee.locationId)) : null) || list.find((x: any) => String(x.id) === "main") || list[0];
  if (!selected) return null;
  const lat = coordinate(selected.lat);
  const lng = coordinate(selected.lng);
  const radius = Number(selected.radiusMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) return null;
  return { id: String(selected.id), lat, lng, radiusMeters: radius };
}

async function timezone(db: D1Database, configured?: string) {
  let tz = String(configured || "Asia/Damascus").trim() || "Asia/Damascus";
  const row = await db.prepare("SELECT value FROM settings WHERE key='timezone' LIMIT 1").first<any>().catch(() => null);
  try {
    const parsed = JSON.parse(String(row?.value || ""));
    if (typeof parsed === "string" && parsed.trim()) tz = parsed.trim();
  } catch {
    if (String(row?.value || "").trim()) tz = String(row.value).trim();
  }
  return tz;
}

async function checkoutWindow(db: D1Database, employeeId: string, now: Date, tz: string) {
  const row = await db.prepare("SELECT id,job_number AS jobNumber,name,status,location_id AS locationId,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,work_start_time AS workStartTime,work_end_time AS workEndTime,work_days_json AS workDaysJson FROM employees WHERE id=? AND status='active' LIMIT 1").bind(employeeId).first<any>();
  if (!row) return { allowed: false, error: "الموظف غير موجود أو موقوف" };

  const lastIn = await db.prepare("SELECT timestamp FROM attendance WHERE employee_id=? AND type='check-in' ORDER BY timestamp DESC LIMIT 1").bind(employeeId).first<any>();
  if (!lastIn?.timestamp) return { allowed: false, error: "لا يمكن تسجيل الانصراف قبل تسجيل الحضور" };

  const checkInAt = new Date(String(lastIn.timestamp));
  if (!Number.isFinite(checkInAt.getTime())) return { allowed: false, error: "تعذر تحديد بداية جلسة الدوام الحالية" };

  const { getAttendanceShift } = await import("./attendance-period");
  const shift = getAttendanceShift(row, checkInAt, tz);
  if (!shift.isWorkDay) return { allowed: false, error: "لا توجد مناوبة صالحة لجلسة الحضور الحالية" };

  const latestOut = await db.prepare("SELECT timestamp FROM attendance WHERE employee_id=? AND type='check-out' AND timestamp>? ORDER BY timestamp DESC LIMIT 1").bind(employeeId, checkInAt.toISOString()).first<any>();
  if (latestOut?.timestamp) return { allowed: false, error: "تم تسجيل الانصراف بالفعل" };

  const graceEnd = new Date(shift.end.getTime() + CHECKOUT_GRACE_MS);
  if (now.getTime() > graceEnd.getTime()) {
    return { allowed: false, error: "انتهت مهلة تسجيل الانصراف لهذه المناوبة (4 ساعات بعد نهايتها)." };
  }

  return { allowed: true, shiftEnd: shift.end.toISOString(), graceEnd: graceEnd.toISOString() };
}

export async function createAttendanceChallenge(req: Request, env: ChallengeEnv, actor: any, deviceId: string, origin: string) {
  if (!actor || String(actor.role).toLowerCase() !== "staff") return json({ ok: false, error: "الموظف فقط يستطيع إنشاء تحقق الحضور" }, 403, origin);
  const body = await req.json().catch(() => null) as any;
  const type = String(body?.type || "").trim();
  const qrCode = String(body?.qrCode || "").trim();
  const lat = coordinate(body?.lat);
  const lng = coordinate(body?.lng);
  const requestedDeviceId = String(body?.deviceId || deviceId || "").trim();
  if (type !== "check-in" && type !== "check-out") return json({ ok: false, error: "نوع الحضور غير صحيح" }, 400, origin);
  if (!qrCode) return json({ ok: false, error: "رمز QR مطلوب" }, 400, origin);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return json({ ok: false, error: "إحداثيات GPS غير صالحة" }, 400, origin);
  if (!requestedDeviceId || requestedDeviceId !== deviceId) return json({ ok: false, error: "هوية الجهاز غير صالحة" }, 403, origin);
  if (actor.deviceId && String(actor.deviceId).trim() && String(actor.deviceId).trim() !== requestedDeviceId) return json({ ok: false, error: "هذا الجهاز غير مرتبط بحساب الموظف" }, 403, origin);

  await ensureAttendanceChallengeSchema(env.DB);
  const location = await employeeLocation(env.DB, String(actor.id));
  if (!location) return json({ ok: false, error: "لا يوجد موقع عمل صالح محفوظ في D1" }, 409, origin);
  const distance = distanceMeters(lat, lng, location.lat, location.lng);
  if (distance > location.radiusMeters) return json({ ok: false, error: `أنت خارج نطاق موقع العمل. المسافة ${distance} م، والنطاق ${location.radiusMeters} م.` }, 403, origin);

  if (type === "check-out") {
    const tz = await timezone(env.DB, env.APP_TIMEZONE);
    const window = await checkoutWindow(env.DB, String(actor.id), new Date(), tz);
    if (!window.allowed) return json({ ok: false, error: window.error }, 403, origin);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const id = crypto.randomUUID();
  await env.DB.prepare("UPDATE attendance_challenges SET used_at=? WHERE employee_id=? AND used_at IS NULL AND expires_at<=?").bind(now.toISOString(), actor.id, now.toISOString()).run();
  await env.DB.prepare("INSERT INTO attendance_challenges(id,employee_id,device_id,type,qr_code,lat,lng,location_id,created_at,expires_at,used_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)").bind(id,actor.id,requestedDeviceId,type,qrCode,lat,lng,location.id,now.toISOString(),expiresAt.toISOString()).run();
  return json({ ok: true, challengeId: id, expiresAt: expiresAt.toISOString(), distanceMeters: distance, locationId: location.id }, 201, origin);
}

export async function claimAttendanceChallenge(db: D1Database, actor: any, deviceId: string, body: any) {
  if (!actor || String(actor.role).toLowerCase() !== "staff") return { ok: false, status: 403, error: "الموظف فقط يستطيع تسجيل الحضور" };
  const challengeId = String(body?.challengeId || "").trim();
  if (!challengeId) return { ok: false, status: 400, error: "تحقق الحضور مطلوب. أعد المحاولة." };
  const row = await db.prepare("SELECT id,employee_id AS employeeId,device_id AS deviceId,type,qr_code AS qrCode,lat,lng,location_id AS locationId,expires_at AS expiresAt,used_at AS usedAt FROM attendance_challenges WHERE id=? LIMIT 1").bind(challengeId).first<any>();
  if (!row) return { ok: false, status: 403, error: "رمز التحقق غير موجود أو انتهت صلاحيته." };
  if (String(row.employeeId) !== String(actor.id)) return { ok: false, status: 403, error: "رمز التحقق لا يخص هذا الموظف." };
  if (String(row.deviceId) !== String(deviceId)) return { ok: false, status: 403, error: "رمز التحقق لا يخص هذا الجهاز." };
  if (row.usedAt) return { ok: false, status: 409, error: "تم استخدام رمز التحقق مسبقًا." };
  if (Date.now() >= Date.parse(String(row.expiresAt))) return { ok: false, status: 403, error: "انتهت صلاحية التحقق. أعد المحاولة." };
  if (String(row.type) !== String(body?.type || "")) return { ok: false, status: 403, error: "نوع عملية الحضور لا يطابق التحقق." };
  if (String(row.qrCode) !== String(body?.qrCode || "").trim()) return { ok: false, status: 403, error: "رمز QR لا يطابق التحقق." };

  const lat = coordinate(body?.lat);
  const lng = coordinate(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, status: 400, error: "إحداثيات GPS غير صالحة." };
  const drift = distanceMeters(lat, lng, Number(row.lat), Number(row.lng));
  if (drift > 100) return { ok: false, status: 403, error: "تغير الموقع بشكل كبير منذ بدء التحقق. أعد المحاولة." };

  if (String(row.type) === "check-out") {
    const tz = await timezone(db);
    const window = await checkoutWindow(db, String(actor.id), new Date(), tz);
    if (!window.allowed) return { ok: false, status: 403, error: window.error };
  }

  const claimedAt = new Date().toISOString();
  const result = await db.prepare("UPDATE attendance_challenges SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? ").bind(claimedAt, challengeId, claimedAt).run();
  if (!result.meta?.changes) return { ok: false, status: 409, error: "تم استخدام رمز التحقق أو انتهت صلاحيته." };
  return { ok: true, challengeId };
}

export async function releaseAttendanceChallenge(db: D1Database, challengeId: string) {
  if (!challengeId) return;
  await db.prepare("UPDATE attendance_challenges SET used_at=NULL WHERE id=? AND used_at IS NOT NULL").bind(challengeId).run().catch(() => undefined);
}
