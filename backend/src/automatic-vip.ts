import { runAutomaticAttendance } from "./automaticAttendance";

type Env = { DB: D1Database; APP_TIMEZONE?: string };

/**
 * Compatibility entrypoint for the legacy VIP scheduler.
 * VIP attendance is handled by the canonical automatic-attendance engine.
 */
export async function runAutomaticVip(env: Env) {
  return runAutomaticAttendance(env);
}
