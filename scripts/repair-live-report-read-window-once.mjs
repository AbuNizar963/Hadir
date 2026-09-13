import fs from "node:fs";

// One-time migration helper. Removed after canonical source verification.
const path = "backend/src/professional-attendance-report-engine.ts";
const source = fs.readFileSync(path, "utf8");
const pattern = /    const dayAnchor = Date\.parse\(`\$\{day\}T00:00:00Z`\);\n    const attendanceQuery = employeeId\n      \? env\.DB\.prepare\([\s\S]*?\n    const attendanceRows = await attendanceQuery\.all<any>\(\);/;
const replacement = `    const dayStart = new Date(\`${"${day}"}T00:00:00+03:00\`);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const attendanceQuery = employeeId
      ? env.DB.prepare(
          "SELECT id,employee_id AS employeeId,type,timestamp,device_id AS deviceId,qr_code AS qrCode FROM attendance WHERE employee_id=? AND timestamp>=? AND timestamp<? ORDER BY timestamp ASC",
        ).bind(employeeId, dayStart.toISOString(), dayEnd.toISOString())
      : env.DB.prepare(
          "SELECT id,employee_id AS employeeId,type,timestamp,device_id AS deviceId,qr_code AS qrCode FROM attendance WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC",
        ).bind(dayStart.toISOString(), dayEnd.toISOString());
    const attendanceRows = await attendanceQuery.all<any>();`;
if (!pattern.test(source)) {
  throw new Error("live report broad attendance window anchor not found");
}
fs.writeFileSync(path, source.replace(pattern, replacement));
