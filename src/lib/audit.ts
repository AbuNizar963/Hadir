import { addAudit } from "@/lib/storage";
import type { AuditEntry } from "@/types";
import { getClientIpPlaceholder, getDeviceId } from "@/lib/device";

export function log(
  entry: Omit<AuditEntry, "id" | "timestamp" | "deviceId" | "ip"> & {
    deviceId?: string;
    ip?: string;
  }
) {
  const e: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
    deviceId: entry.deviceId ?? getDeviceId(),
    ip: entry.ip ?? getClientIpPlaceholder(),
  };

  addAudit(e);
  return e;
}
