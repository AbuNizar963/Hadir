import base from "./attendance-safety-gateway";
import { HadirRealtime } from "./realtime";
import { archiveClosedMonth } from "./report-archive";

export { HadirRealtime };
type Env = { DB: D1Database; REPORT_ARCHIVES?: R2Bucket; APP_TIMEZONE?: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) { return base.fetch(request, env, ctx); },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (typeof (base as any).scheduled === "function") await (base as any).scheduled(controller, env, ctx);
    try { console.log("[report-archive]", JSON.stringify(await archiveClosedMonth(env))); }
    catch (error) { console.error("[report-archive] monthly archive failed", error); }
  },
};
