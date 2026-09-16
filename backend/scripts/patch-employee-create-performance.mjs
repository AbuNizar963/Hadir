import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/index.ts");
const source = fs.readFileSync(target, "utf8");

const oldBlock = `          await env.DB.prepare(
            "INSERT INTO employees(id,job_number,name,pin_hash,status,device_id,device_label,created_at,schedule_type,rotation_start_date,work_start_time,work_end_time,grace_period_minutes,role,location_id,rotation_days_on,rotation_days_off,specialties_json,work_days_json,avatar) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
            .bind(
              employeeId,
              jobNumber,
              name,
              await hashPassword(pin),
              b.status || "active",
              null,
              null,
              now(),
              b.scheduleType || "ADMIN",
              b.rotationStartDate || null,
              b.workStartTime || null,
              b.workEndTime || null,
              Number(b.gracePeriodMinutes ?? 10),
              "staff",
              b.locationId || null,
              b.rotationDaysOn ?? null,
              b.rotationDaysOff ?? null,
              JSON.stringify(b.specialties || []),
              JSON.stringify(b.workDays || []),
              b.avatar || null,
            )
            .run();`;

const newBlock = `          await env.DB.prepare(
            "INSERT INTO employees(id,job_number,name,pin_hash,status,device_id,device_label,created_at,schedule_type,rotation_start_date,work_start_time,work_end_time,grace_period_minutes,role,location_id,rotation_days_on,rotation_days_off,rotation_daily_attendance_enabled,rotation_daily_attendance_time,rotation_daily_attendance_grace_minutes,early_checkout_grace_minutes,specialties_json,work_days_json,avatar) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
            .bind(
              employeeId,
              jobNumber,
              name,
              await hashPassword(pin),
              b.status || "active",
              null,
              null,
              now(),
              b.scheduleType || "ADMIN",
              b.rotationStartDate || null,
              b.workStartTime || null,
              b.workEndTime || null,
              Number(b.gracePeriodMinutes ?? 10),
              "staff",
              b.locationId || null,
              b.rotationDaysOn ?? null,
              b.rotationDaysOff ?? null,
              b.rotationDailyAttendanceEnabled ? 1 : 0,
              b.rotationDailyAttendanceTime || null,
              Number(b.rotationDailyAttendanceGraceMinutes ?? 0),
              Number(b.earlyCheckoutGraceMinutes ?? 0),
              JSON.stringify(b.specialties || []),
              JSON.stringify(b.workDays || []),
              b.avatar || null,
            )
            .run();`;

if (source.includes(newBlock)) {
  process.stdout.write("employee create performance patch already applied\\n");
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  throw new Error("Expected employee INSERT handler was not found; refusing to patch an unknown source layout.");
}

fs.writeFileSync(target, source.replace(oldBlock, newBlock), "utf8");
process.stdout.write("employee create performance patch applied\\n");
