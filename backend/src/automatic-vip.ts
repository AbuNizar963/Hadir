import { runAutomaticAttendance } from "./automaticAttendance";

type Env = { DB: D1Database; APP_TIMEZONE?: string };

/**
 * Compatibility entrypoint for the legacy VIP scheduler.
 *
 * VIP attendance is no longer maintained by a second attendance algorithm.
 * The canonical automatic-attendance engine owns the shift resolution,
 * duplicate detection, check-in and check-out rules for VIP employees too.
 */
export async function runAutomaticVip(env: Env) {
  return runAutomaticAttendance(env);
}
