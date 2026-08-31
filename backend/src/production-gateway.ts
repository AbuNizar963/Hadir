import employeeGateway, { HadirRealtime } from "./employee-save-gateway";
import { handleDailyStatus } from "./daily-status-api";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  PROFILE_IMAGES?: R2Bucket;
  REALTIME: DurableObjectNamespace;
};

let leaveSchemaReady: Promise<void> | null = null;

function origin(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  const configured = [String(env.APP_ORIGIN || ""), String(env.APP_ORIGINS || "")]
    .flatMap(v => v.split(","))
    .map(v => v.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (incoming && (configured.length === 0 || configured.includes(incoming) || /^https:\/\/[^/]+\.pages\.dev$/i.test(incoming) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming))) return incoming;
  return configured[0] || "*";
}

function cors(request: Request, env: Env) {
  return {
    "access-control-allow-origin": origin(request, env),
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type, x-device-id",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "cache-control": "no-store",
    "vary": "Origin",
  };
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bearerToken(request: Request) {
  return String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function ownerActor(request: Request, env: Env) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const tokenHash = await hashToken(token);
    const session = await env.DB.prepare(
      "SELECT user_id AS userId,user_type AS userType,role FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL LIMIT 1"
    ).bind(tokenHash).first<any>();
    if (!session || session.userType !== "admin") return null;
    const admin = await env.DB.prepare(
      "SELECT id,username,name,role,active FROM admin_accounts WHERE id=? LIMIT 1"
    ).bind(session.userId).first<any>();
    if (!admin || !admin.active || String(admin.role).toLowerCase() !== "owner") return null;
    return { id: String(admin.id), username: String(admin.username || ""), name: String(admin.name || ""), role: "owner" as const };
  } catch {
    return null;
  }
}

async function ensureLeaveSchema(env: Env) {
  if (!leaveSchemaReady) {
    leaveSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer_id TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates ON leave_requests(employee_id,start_date,end_date)"),
    ]).then(() => undefined).catch(error => {
      leaveSchemaReady = null;
      throw error;
    });
  }
  await leaveSchemaReady;
}

async function authenticatedActor(request: Request, env: Env, ctx: ExecutionContext) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";
  const probe = await employeeGateway.fetch(new Request(probeUrl, {
    method: "GET",
    headers: request.headers,
  }), env, ctx);
  if (!probe.ok) return null;
  const data = await probe.json().catch(() => ({})) as any;
  return data?.user || null;
}

function employeeOut(row: any) {
  const parse = (value: unknown) => { try { return JSON.parse(String(value || "[]")); } catch { return []; } };
  return {
    id: row.id,
    jobNumber: row.job_number,
    name: row.name,
    status: row.status,
    deviceId: row.device_id,
    deviceLabel: row.device_label,
    createdAt: row.created_at,
    scheduleType: row.schedule_type,
    rotationStartDate: row.rotation_start_date,
    avatar: row.avatar || null,
    workStartTime: row.work_start_time,
    workEndTime: row.work_end_time,
    gracePeriodMinutes: row.grace_period_minutes,
    role: row.role,
    locationId: row.location_id,
    rotationDaysOn: row.rotation_days_on,
    rotationDaysOff: row.rotation_days_off,
    workDays: parse(row.work_days_json),
    specialties: parse(row.specialties_json),
    isVip: Boolean(Number(row.is_vip || 0)),
    autoCheckIn: Boolean(Number(row.auto_check_in || 0)),
    autoCheckOut: Boolean(Number(row.auto_check_out || 0)),
  };
}

async function handleWorkforcePatch(request: Request, env: Env, headers: Record<string, string>) {
  // This endpoint is deliberately self-contained. It does not proxy the
  // mutation through another Worker handler, so the production VIP controls
  // have exactly one authenticated D1 write/read-back path.
  const actor = await ownerActor(request, env);
  if (!actor) {
    return new Response(JSON.stringify({ ok: false, error: "المالك فقط يستطيع تعديل إعدادات Workforce" }), {
      status: 403,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const employeeId = String(body.employeeId || "").trim();
  if (!employeeId) {
    return new Response(JSON.stringify({ ok: false, error: "معرف الموظف مطلوب" }), {
      status: 400,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }

  const current = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
  if (!current) {
    return new Response(JSON.stringify({ ok: false, error: "الموظف غير موجود" }), {
      status: 404,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }

  const mapping: Record<string, string> = {
    isVip: "is_vip",
    autoCheckIn: "auto_check_in",
    autoCheckOut: "auto_check_out",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(mapping)) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") {
      return new Response(JSON.stringify({ ok: false, error: `${key} يجب أن تكون true أو false` }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" },
      });
    }
    sets.push(`${mapping[key]}=?`);
    values.push(body[key] ? 1 : 0);
  }
  if (!sets.length) {
    return new Response(JSON.stringify({ ok: false, error: "لا توجد تغييرات" }), {
      status: 400,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }

  values.push(employeeId);
  try {
    const result = await env.DB.prepare(`UPDATE employees SET ${sets.join(",")} WHERE id=?`).bind(...values).run();
    if (!result.meta.changes) {
      return new Response(JSON.stringify({ ok: false, error: "لم يتم تعديل سجل الموظف في D1" }), {
        status: 409,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" },
      });
    }

    const saved = await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
    if (!saved) {
      return new Response(JSON.stringify({ ok: false, error: "تم التحديث لكن تعذر قراءة الموظف من D1" }), {
        status: 500,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" },
      });
    }

    const returned = employeeOut(saved);
    for (const key of Object.keys(mapping)) {
      if (body[key] !== undefined && returned[key as keyof typeof returned] !== body[key]) {
        return new Response(JSON.stringify({ ok: false, error: `فشل التحقق من حفظ ${key} في D1` }), {
          status: 500,
          headers: { ...headers, "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    await env.DB.prepare(
      "INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(), employeeId, saved.job_number || "", actor.name || "المالك",
      "workforce-controls", "success", "تحديث إعدادات Workforce من LIVE DIRECTORY",
      new Date().toISOString(), "OWNER_PANEL", "unknown"
    ).run().catch(() => undefined);

    return new Response(JSON.stringify({ ok: true, employee: returned }), {
      status: 200,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    console.error("production workforce patch failed", error);
    return new Response(JSON.stringify({ ok: false, error: "تعذر حفظ إعدادات Workforce في D1", detail: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" },
    });
  }
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    const headers = cors(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (path === "/api/workforce/live" && request.method === "PATCH") {
      return handleWorkforcePatch(request, env, headers);
    }

    if (path === "/api/manager/daily-status") {
      if (request.method !== "GET") return new Response(JSON.stringify({ error: "الطريقة غير مدعومة" }), {
        status: 405,
        headers: { ...headers, "content-type": "application/json; charset=utf-8" },
      });

      try {
        await ensureLeaveSchema(env);
        const actor = await authenticatedActor(request, env, ctx);
        const response = await handleDailyStatus(request, env, actor);
        const merged = new Headers(response.headers);
        for (const [key, value] of Object.entries(headers)) merged.set(key, value);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
      } catch (error) {
        console.error("production daily-status failed", error);
        return new Response(JSON.stringify({ error: "تعذر مزامنة حالة الدوام من D1" }), {
          status: 500,
          headers: { ...headers, "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    return employeeGateway.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (typeof (employeeGateway as any).scheduled === "function") {
      await (employeeGateway as any).scheduled(controller, env, ctx);
    }
  },
};