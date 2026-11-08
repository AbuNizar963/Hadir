import base, { HadirRealtime } from "./employee-save-production-gateway";
import {
  claimAttendanceChallenge,
  createAttendanceChallenge,
  releaseAttendanceChallenge,
} from "./attendance-challenge";

type Env = {
  DB: D1Database;
  APP_ORIGIN?: string;
  APP_ORIGINS?: string;
  APP_TIMEZONE?: string;
  REPORT_ARCHIVE?: R2Bucket;
  PROFILE_IMAGES?: R2Bucket;
  JWT_SECRET?: string;
  OWNER_RECOVERY_CODE?: string;
  BROWSER?: BrowserRun;
};

function allowedOrigin(request: Request, env: Env) {
  const incoming = String(request.headers.get("origin") || "")
    .trim()
    .replace(/\/$/, "");
  const configured = [String(env.APP_ORIGIN || ""), String(env.APP_ORIGINS || "")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (incoming && configured.includes(incoming)) return incoming;

  if (
    !configured.length &&
    incoming &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(incoming)
  ) {
    return incoming;
  }

  return configured[0] || "*";
}

function json(
  data: unknown,
  status: number,
  request: Request,
  env: Env,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": allowedOrigin(request, env),
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type, authorization, x-device-id",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "cache-control": "no-store",
    },
  });
}

async function actorFromBase(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) {
  const probeUrl = new URL(request.url);
  probeUrl.pathname = "/api/me";
  probeUrl.search = "";

  const probe = await base.fetch(
    new Request(probeUrl, {
      method: "GET",
      headers: request.headers,
    }),
    env,
    ctx,
  );

  if (!probe.ok) return null;

  const data = (await probe.json().catch(() => ({}))) as any;
  return data?.user || null;
}

function requestDeviceId(request: Request, actor: any) {
  const headerValue = String(request.headers.get("x-device-id") || "").trim();
  if (headerValue) return headerValue;
  return String(actor?.deviceId || "").trim();
}

export { HadirRealtime };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    // Keep the canonical Worker responsible for preflight and all other routes.
    if (request.method === "OPTIONS") {
      return base.fetch(request, env, ctx);
    }

    if (path === "/api/attendance/challenge" && request.method === "POST") {
      try {
        const actor = await actorFromBase(request, env, ctx);
        const deviceId = requestDeviceId(request, actor);

        if (!deviceId) {
          return json(
            { ok: false, error: "هوية الجهاز غير موجودة" },
            403,
            request,
            env,
          );
        }

        return await createAttendanceChallenge(
          request,
          env,
          actor,
          deviceId,
          allowedOrigin(request, env),
        );
      } catch (error) {
        return json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "فشل إنشاء تحقق الحضور",
          },
          500,
          request,
          env,
        );
      }
    }

    if (path === "/api/attendance" && request.method === "POST") {
      let body: any;

      try {
        body = await request.clone().json();
      } catch {
        return json(
          { ok: false, error: "بيانات الحضور غير صالحة" },
          400,
          request,
          env,
        );
      }

      const actor = await actorFromBase(request, env, ctx);

      // Non-employee and unauthenticated requests retain the canonical
      // authorization response from the existing attendance engine.
      if (!actor || String(actor.role).toLowerCase() !== "staff") {
        return base.fetch(request, env, ctx);
      }

      const challengeId = String(body?.challengeId || "").trim();
      if (!challengeId) {
        return json(
          { ok: false, error: "تحقق الحضور مطلوب. أعد المحاولة." },
          403,
          request,
          env,
        );
      }

      const deviceId = requestDeviceId(request, actor);
      if (!deviceId) {
        return json(
          { ok: false, error: "هوية الجهاز غير موجودة" },
          403,
          request,
          env,
        );
      }

      try {
        const claim = await claimAttendanceChallenge(
          env.DB,
          actor,
          deviceId,
          body,
        );

        if (!claim.ok) {
          return json(
            { ok: false, error: claim.error },
            claim.status,
            request,
            env,
          );
        }

        const response = await base.fetch(request, env, ctx);
        if (!response.ok) {
          await releaseAttendanceChallenge(env.DB, challengeId);
        }

        return response;
      } catch (error) {
        await releaseAttendanceChallenge(env.DB, challengeId);

        return json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "فشل تسجيل الحضور",
          },
          500,
          request,
          env,
        );
      }
    }

    return base.fetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ) {
    const scheduled = (base as any).scheduled;
    if (typeof scheduled === "function") {
      await scheduled(controller, env, ctx);
    }
  },
};
