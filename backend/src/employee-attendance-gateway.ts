import { handleAttendanceThroughCentralEngine, submitAttendanceThroughCentralEngine } from "./attendance-engine-central";

type Env = { DB: D1Database };

/**
 * Public attendance gateway.
 *
 * Every HTTP attendance request enters the central attendance engine before
 * reaching the canonical D1 writer. This keeps the route stable for existing
 * callers while preventing a second application-level attendance path.
 */
export async function handleEmployeeAttendance(req: Request, env: Env, actor: any, origin: string) {
  return handleAttendanceThroughCentralEngine(req, env, actor, origin);
}

/** Internal compatibility export for automatic/VIP and administrative flows. */
export { submitAttendanceThroughCentralEngine };
