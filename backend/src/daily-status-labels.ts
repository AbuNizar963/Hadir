export type DailyStatusCode = "PRESENT" | "LATE" | "ABSENT" | "REST" | "LEAVE" | "PERMISSION" | "ESCAPED" | "NOT_STARTED" | "INVALID" | "OPEN";

const DAILY_STATUS_LABELS: Record<DailyStatusCode, string> = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  ABSENT: "غياب",
  REST: "راحة",
  LEAVE: "إجازة",
  PERMISSION: "إذن",
  ESCAPED: "انصراف دون إذن",
  NOT_STARTED: "لم يبدأ",
  INVALID: "غير صالح",
  OPEN: "انصراف معلق",
};

export function dailyStatusLabel(status: string): string {
  return DAILY_STATUS_LABELS[status as DailyStatusCode] || status;
}
