  const cycleLength = daysOn + daysOff;

  if (cycleLength <= 0) {
    return { isWorkDay: false, isLastWorkDay: false };
  }

  const diff = Math.floor(dayNumber(day) - dayNumber(startDay));

  if (diff < 0) {
    return { isWorkDay: false, isLastWorkDay: false };
  }

  const cycleDay = diff % cycleLength;

  return {
    isWorkDay: cycleDay < daysOn,
    isLastWorkDay: cycleDay === daysOn - 1,
  };
}

function shouldIncludeReportRow(
  row: FactRow,
  meta: ScheduleMeta | undefined,
  dailyReport: boolean,
): boolean {
  if (row.status === "REST" || row.status === "NOT_STARTED") {
    return false;
  }

  if (!meta) return true;

  const scheduleType = String(meta.scheduleType || "ADMIN")
    .trim()
    .toUpperCase();

  if (scheduleType === "ROTATION") {
    const rotation = rotationWorkDay(row.attendanceDay, meta);

    if (!rotation.isWorkDay) return false;

    return !dailyReport || rotation.isLastWorkDay;
  }

  return normalizeWorkDays(meta.workDaysJson).includes(
    dayWeekday(row.attendanceDay),
  );
}

async function filterReportableRows(
  env: Env,
  rows: FactRow[],
  dailyReport: boolean,
): Promise<FactRow[]> {
  if (!rows.length) return [];

  const employeeIds = [...new Set(rows.map((row) => row.employeeId))];
  const placeholders = employeeIds.map(() => "?").join(",");

  const result = await env.DB.prepare(
    `SELECT