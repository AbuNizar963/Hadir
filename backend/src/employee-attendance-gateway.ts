import { submitAttendanceThroughCentralEngine } from "./attendance-engine-central";
import { handleEmployeeAttendance as executeCanonicalAttendance } from "./attendance-engine-commands";

type Env = { DB: D1Database };

/**
 * Public attendance gateway.
 *
 * Every HTTP attendance request enters this module first. The actual D1 write
 * remains exclusively inside the canonical attendance engine, while the
 * central gateway is the only application-level route into that engine.
 */
export async function handleEmployeeAttendance(req: Request, env: Env, actor: any, origin: string) {
  return executeCanonicalAttendance(req, env, actor, origin);
}

/**
 * Internal callers (automatic/VIP and administrative flows) use the same
 * central gateway without constructing an HTTP session.
 */
export { submitAttendanceThroughCentralEngine };
