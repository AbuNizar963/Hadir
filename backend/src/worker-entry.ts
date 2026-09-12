import base, { HadirRealtime } from "./attendance-safety-gateway";
import { archiveClosedMonth } from "./report-archive";

export { HadirRealtime };

type Env = { DB: D1Database; REPORT_ARCHIVES?: R2Bucket; APP_TIMEZONE?: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return base.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (typeof (base as any).scheduled === "function") await (base as any).scheduled(controller, env, ctx);
    try {
      const result = await archiveClosedMonth(env);
      console.log("[report-archive]", JSON.stringify(result));
    } catch (error) {
      console.error("[report-archive] monthly archive failed", error);
    }
  },
};
