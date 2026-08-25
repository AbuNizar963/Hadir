import { cn } from "@/lib/utils";

export function LiveStatusDot({ status = "live", label }: { status?: "live" | "warning" | "danger" | "info"; label?: string }) {
  return <span className="inline-flex items-center gap-2" aria-label={label || "حالة مباشرة"} title={label}>
    <span className={cn("live-status-dot", status !== "live" && `live-status-dot-${status}`)} data-status={status === "live" ? undefined : status} />
    {label ? <span>{label}</span> : null}
  </span>;
}
