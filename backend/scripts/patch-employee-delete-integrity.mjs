import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/index.ts");
const source = fs.readFileSync(target, "utf8");

const handlerPattern =
  /if\(path\.startsWith\("\/api\/employees\/"\)&&req\.method==="DELETE"&&!path\.endsWith\("\/device"\)\)\{.*?return json\(\{ok:true\},200,origin\);\}/s;

const matches = source.match(handlerPattern) || [];

if (matches.length === 0) {
  if (source.includes("EMPLOYEE_DELETE_CONSTRAINT")) {
    process.stdout.write("employee delete integrity patch already applied\n");
    process.exit(0);
  }

  throw new Error(
    "Expected employee DELETE handler was not found; refusing to patch an unknown source layout.",
  );
}

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one employee DELETE handler, found ${matches.length}.`,
  );
}

const newBlock = `if (
  path.startsWith("/api/employees/") &&
  req.method === "DELETE" &&
  !path.endsWith("/device")
) {
  if (!canWrite(actor.role))
    return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);

  const employeeId = decodeURIComponent(
    path.split("/").pop() || "",
  ).trim();
  if (!employeeId)
    return json({ error: "معرّف الموظف غير صالح" }, 400, origin);

  const employee = await env.DB.prepare(
    "SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? LIMIT 1",
  )
    .bind(employeeId)
    .first<any>();

  if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);

  try {
    const cleanupTables = [
      ["daily_attendance_status", "employee_id"],
      ["employee_passkeys", "employee_id"],
      ["webauthn_challenges", "employee_id"],
      ["employee_webauthn_credentials", "employee_id"],
      ["employee_webauthn_challenges", "employee_id"],
      ["employee_device_events", "employee_id"],
      ["employee_requests", "employee_id"],
      ["requests", "employee_id"],
      ["violations", "employee_id"],
      ["leave_requests", "employee_id"],
      ["performance_reviews", "employee_id"],
      ["payroll_entries", "employee_id"],
      ["anomaly_events", "employee_id"],
      ["auth_sessions", "user_id"],
      ["notifications", "recipient_id"],
      ["push_subscriptions", "user_id"],
    ] as const;

    const tableNames = cleanupTables.map(([table]) => table);
    const placeholders = tableNames.map(() => "?").join(",");
    const existingRows = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN (" +
        placeholders +
        ")",
    )
      .bind(...tableNames)
      .all<{ name: string }>();
    const existingTables = new Set(
      existingRows.results.map((row) => String(row.name)),
    );

    const cleanupStatements = cleanupTables
      .filter(([table]) => existingTables.has(table))
      .map(([table, column]) => {
        if (table === "auth_sessions") {
          return env.DB.prepare(
            "DELETE FROM auth_sessions WHERE user_id=? AND user_type='employee'",
          ).bind(employeeId);
        }

        return env.DB.prepare(
          `DELETE FROM ${table} WHERE ${column}=?`,
        ).bind(employeeId);
      });

    if (existingTables.has("tasks")) {
      cleanupStatements.push(
        env.DB.prepare(
          "UPDATE tasks SET assignee_id=NULL WHERE assignee_id=?",
        ).bind(employeeId),
      );
    }

    cleanupStatements.push(
      env.DB.prepare("DELETE FROM employees WHERE id=?").bind(employeeId),
    );

    await env.DB.batch(cleanupStatements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    console.error("employee-delete-failed", { employeeId, message });
    return json(
      {
        error: "تعذر حذف الموظف بسبب قيد في قاعدة البيانات.",
        code: "EMPLOYEE_DELETE_CONSTRAINT",
      },
      409,
      origin,
    );
  }

  return json(
    {
      ok: true,
      deleted: {
        id: employee.id,
        jobNumber: employee.jobNumber,
        name: employee.name,
      },
    },
    200,
    origin,
  );
}`;

const updated = source.replace(handlerPattern, newBlock);

if (updated === source) {
  throw new Error("Employee delete patch made no change.");
}

if (!updated.includes("EMPLOYEE_DELETE_CONSTRAINT")) {
  throw new Error(
    "Employee delete patch validation failed: constraint handling is missing.",
  );
}

if (updated.match(handlerPattern)) {
  throw new Error(
    "Employee delete patch validation failed: the original direct-delete handler remains.",
  );
}

fs.writeFileSync(target, updated, "utf8");
process.stdout.write("employee delete integrity patch applied\n");
