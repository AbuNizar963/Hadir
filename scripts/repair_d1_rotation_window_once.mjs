import fs from "node:fs";

const path = "backend/src/attendance-engine.ts";
let source = fs.readFileSync(path, "utf8");

const oldUrl =
  'nextDay = addDays(day, 1),\n    to = localDateTimeUtc(addDays(day, 2), "00:00").toISOString();';
const newUrl = 'nextDay = addDays(day, 1);';
if (!source.includes(oldUrl)) {
  throw new Error("daily-status narrow URL window anchor not found");
}
source = source.replace(oldUrl, newUrl);

const oldHistorical = `    const historical = await env.DB.prepare(
      "SELECT employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC",
    )
      .bind(historicalFrom, to)
      .all<any>();`;
const newHistorical = `    const historicalTo = localDateTimeUtc(
      addDays(day, Math.max(2, maxRotationOn + 1)),
      "00:00",
    ).toISOString();
    const historical = await env.DB.prepare(
      "SELECT employee_id AS employeeId,type,timestamp FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC",
    )
      .bind(historicalFrom, historicalTo)
      .all<any>();`;
if (!source.includes(oldHistorical)) {
  throw new Error("daily-status historical query anchor not found");
}
source = source.replace(oldHistorical, newHistorical);

fs.writeFileSync(path, source);
