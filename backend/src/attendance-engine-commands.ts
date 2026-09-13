import { dateKey } from "./attendance-period";
import { handleDailyStatus } from "./attendance-engine";

type Env = { DB: D1Database };
const TZ = "Asia/Damascus";

export async function refreshCanonicalStatus(env: Env, actor: any, now: Date) {
  try {
    const day = dateKey(now, TZ);
    await handleDailyStatus(
      new Request(`https://hadir.local/api/manager/daily-status?date=${encodeURIComponent(day)}`, { method: "GET" }),
      env,
      actor,
    );
  } catch (error) {
    console.error("attendance status refresh failed", error);
  }
}
