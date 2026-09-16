import { readFileSync, writeFileSync } from "node:fs";

const fileUrl = new URL("../backend/src/workforce.ts", import.meta.url);
const source = readFileSync(fileUrl, "utf8");

const legacyQuery = `    const att = await rows(
      env.DB,
      "SELECT employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=datetime('now','-1 day') ORDER BY timestamp DESC LIMIT 5000",
    );`;

const optimizedQuery = `    const att = await rows(
      env.DB,
      "SELECT employee_id AS employeeId,type,timestamp FROM (SELECT employee_id,type,timestamp,ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY timestamp DESC) AS rowNumber FROM attendance WHERE timestamp>=datetime('now','-1 day')) WHERE rowNumber=1",
    );`;

const legacySummary = `    const checkedIn = new Set(
      (att as any[])
        .filter((x) => x.type === "check-in")
        .map((x) => x.employeeId),
    );
    const checkedOut = new Set(
      (att as any[])
        .filter((x) => x.type === "check-out")
        .map((x) => x.employeeId),
    );`;

const optimizedSummary = `    const latestAttendance = new Map(
      (att as any[]).map((x) => [String(x.employeeId), x]),
    );`;

const legacyCounts = `        checkedIn: active.filter(
          (x) => checkedIn.has(x.id) && !checkedOut.has(x.id),
        ).length,
        checkedOut: active.filter((x) => checkedOut.has(x.id)).length,`;

const optimizedCounts = `        checkedIn: active.filter(
          (x) => latestAttendance.get(String(x.id))?.type === "check-in",
        ).length,
        checkedOut: active.filter(
          (x) => latestAttendance.get(String(x.id))?.type === "check-out",
        ).length,`;

function countOccurrences(value, fragment) {
  return value.split(fragment).length - 1;
}

const alreadyApplied =
  source.includes(optimizedQuery) &&
  source.includes(optimizedSummary) &&
  source.includes(optimizedCounts);

if (alreadyApplied) {
  if (
    source.includes(legacyQuery) ||
    source.includes(legacySummary) ||
    source.includes(legacyCounts)
  ) {
    throw new Error(
      "Workforce live attendance read patch: both legacy and optimized implementations are present; refusing ambiguous source.",
    );
  }

  console.log("Workforce live attendance read patch: already applied; skipping.");
  process.exit(0);
}

for (const [name, fragment] of [
  ["legacy query", legacyQuery],
  ["legacy summary", legacySummary],
  ["legacy counts", legacyCounts],
]) {
  const occurrences = countOccurrences(source, fragment);
  if (occurrences !== 1) {
    throw new Error(
      `Workforce live attendance read patch: expected exactly one ${name}, found ${occurrences}; refusing unsafe replacement.`,
    );
  }
}

let next = source.replace(legacyQuery, optimizedQuery);
next = next.replace(legacySummary, optimizedSummary);
next = next.replace(legacyCounts, optimizedCounts);

if (
  !next.includes(optimizedQuery) ||
  !next.includes(optimizedSummary) ||
  !next.includes(optimizedCounts) ||
  next.includes(legacyQuery) ||
  next.includes(legacySummary) ||
  next.includes(legacyCounts)
) {
  throw new Error(
    "Workforce live attendance read patch: post-replacement validation failed; refusing partial write.",
  );
}

writeFileSync(fileUrl, next, "utf8");
console.log(
  "Workforce live attendance read patch: latest-per-employee attendance query applied.",
);
