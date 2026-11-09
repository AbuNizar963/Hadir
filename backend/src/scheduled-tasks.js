/**
 * Identifies the monthly maintenance window used for report archiving.
 *
 * Keeping this check in a small pure module makes it testable and prevents
 * the monthly archive from running on the five-minute attendance cron.
 */
export const MONTHLY_REPORT_ARCHIVE_CRON = "0 2 1 * *";

export function isMonthlyReportArchiveSchedule(cron) {
  return cron === MONTHLY_REPORT_ARCHIVE_CRON;
}
