import fs from "node:fs";
import path from "node:path";

const target = path.resolve("src/index.ts");
const source = fs.readFileSync(target, "utf8");

const oldBlock = `      if (
        path.startsWith("/api/employees/") &&
        req.method === "DELETE" &&
        !path.endsWith("/device")
      ) {
        if (!canWrite(actor.role))
          return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);
        await env.DB.prepare("DELETE FROM employees WHERE id=?")
          .bind(decodeURIComponent(path.split("/").pop() || ""))
          .run();
        return json({ ok: true }, 200, origin);
      }`;

const newBlock = `      if (
        path.startsWith("/api/employees/") &&
        req.method === "DELETE" &&
        !path.endsWith("/device")
      ) {
        if (!canWrite(actor.role))
          return json({ error: "لا تملك صلاحية الكتابة" }, 403, origin);

        const employeeId = decodeURIComponent(path.split("/").pop() || "").trim();
        if (!employeeId)
          return json({ error: "معرّف الموظف غير صالح" }, 400, origin);

        const employee = await env.DB.prepare(
          "SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? LIMIT 1",
        )
          .bind(employeeId)
          .first<any>();

        if (!employee)
          return json({ error: "الموظف غير موجود" }, 404, origin);

        try {
          /*
           * Clean employee-owned rows that can retain restrictive foreign keys
           * on legacy D1 installations before removing the employee itself.
           * Historical attendance/audit/reporting rows are intentionally kept.
           */
          await env.DB.batch([
            env.DB.prepare("DELETE FROM daily_attendance_status WHERE employee_id=?").bind(employeeId),
            env.DB.prepare("DELETE FROM employee_webauthn_credentials WHERE employee_id=?").bind(employeeId),
            env.DB.prepare("DELETE FROM employee_device_events WHERE employee_id=?").bind(employeeId),
            env.DB.prepare("DELETE FROM employee_webauthn_challenges WHERE employee_id=?").bind(employeeId),
            env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=? AND user_type='employee'").bind(employeeId),
            env.DB.prepare("DELETE FROM employees WHERE id=?").bind(employeeId),
          ]);
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
          { ok: true, deleted: { id: employee.id, jobNumber: employee.jobNumber, name: employee.name } },
          200,
          origin,
        );
      }`;

if (source.includes(newBlock)) {
  process.stdout.write("employee delete integrity patch already applied\n");
  process.exit(0);
}

if (!source.includes(oldBlock)) {
  throw new Error("Expected employee DELETE handler was not found; refusing to patch an unknown source layout.");
}

fs.writeFileSync(target, source.replace(oldBlock, newBlock), "utf8");
process.stdout.write("employee delete integrity patch applied\n");
