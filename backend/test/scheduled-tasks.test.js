import assert from "node:assert/strict";
import test from "node:test";
import {
  isMonthlyReportArchiveSchedule,
  MONTHLY_REPORT_ARCHIVE_CRON,
} from "../src/scheduled-tasks.js";

test("runs monthly report archive only on the monthly cron", () => {
  assert.equal(isMonthlyReportArchiveSchedule(MONTHLY_REPORT_ARCHIVE_CRON), true);
  assert.equal(isMonthlyReportArchiveSchedule("*/5 * * * *"), false);
  assert.equal(isMonthlyReportArchiveSchedule("0 * * * *"), false);
  assert.equal(isMonthlyReportArchiveSchedule(""), false);
  assert.equal(isMonthlyReportArchiveSchedule(undefined), false);
});
