import type { Employee } from "@/types";

export type WorkforceCardControlsProps = {
  employee: Employee;
  owner: boolean;
  busy?: boolean;
  onCheckIn: (employee: Employee) => void;
  onCheckOut: (employee: Employee) => void;
  onToggleVip: (employee: Employee) => void;
  onToggleAutoCheckIn: (employee: Employee) => void;
  onToggleAutoCheckOut: (employee: Employee) => void;
};

/**
 * Compact workforce section intended for the existing employee card.
 * The component is deliberately presentational: authorization remains
 * server-side, while `owner` only controls whether owner actions are shown.
 */
export default function WorkforceCardControls({
  employee,
  owner,
  busy = false,
  onCheckIn,
  onCheckOut,
  onToggleVip,
  onToggleAutoCheckIn,
  onToggleAutoCheckOut,
}: WorkforceCardControlsProps) {
  return (
    <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black">قوى العمل</span>
          {employee.isVip && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-600">
              ⭐ VIP
            </span>
          )}
        </div>

        {owner && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || employee.status !== "active"}
              className="btn-primary text-[10px]"
              onClick={() => onCheckIn(employee)}
            >
              تحضير مباشر
            </button>
            <button
              type="button"
              disabled={busy || employee.status !== "active"}
              className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[10px] font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              onClick={() => onCheckOut(employee)}
            >
              انصراف مباشر
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={!owner || busy}
          aria-pressed={Boolean(employee.isVip)}
          className={`rounded-xl border px-2 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
            employee.isVip
              ? "border-amber-400/40 bg-amber-400/10 text-amber-700"
              : "border-border/60 bg-background/30 text-muted-foreground"
          }`}
          onClick={() => onToggleVip(employee)}
        >
          ⭐ VIP
        </button>

        <button
          type="button"
          disabled={!owner || busy}
          aria-pressed={Boolean(employee.autoCheckIn)}
          className={`rounded-xl border px-2 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
            employee.autoCheckIn
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 bg-background/30 text-muted-foreground"
          }`}
          onClick={() => onToggleAutoCheckIn(employee)}
        >
          تلقائي دخول
        </button>

        <button
          type="button"
          disabled={!owner || busy}
          aria-pressed={Boolean(employee.autoCheckOut)}
          className={`rounded-xl border px-2 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
            employee.autoCheckOut
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 bg-background/30 text-muted-foreground"
          }`}
          onClick={() => onToggleAutoCheckOut(employee)}
        >
          تلقائي خروج
        </button>
      </div>
    </div>
  );
}
