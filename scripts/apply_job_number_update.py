from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "backend/src/recovery.ts"
text = TARGET.read_text(encoding="utf-8")

marker = '    if (path.match(/^\\/api\\/employees\\/[^/]+\\/avatar$/)) {'
if "JOB_NUMBER_UPDATE_PATCH_V1" in text:
    print("job-number patch already present")
    raise SystemExit(0)
if marker not in text:
    raise SystemExit("Refusing unsafe patch: recovery.ts route marker was not found")

patch = r'''    /* JOB_NUMBER_UPDATE_PATCH_V1 */
    const employeePatch = path.match(/^\/api\/employees\/([^/]+)$/);
    if (employeePatch && req.method === "PATCH") {
      const actor = await actorFromOriginal(req, env);
      if (!actor || !["owner", "manager"].includes(String(actor.role))) return json({ error: "غير مصرح" }, 403, origin);
      await ensureRecoveryTables(env.DB);
      const employeeId = decodeURIComponent(employeePatch[1]);
      const body = await req.clone().json().catch(() => ({})) as Record<string, unknown>;
      if (body.jobNumber === undefined) return original.fetch(req, env, {} as ExecutionContext);
      const nextJobNumber = String(body.jobNumber || "").trim();
      if (!nextJobNumber) return json({ error: "الرقم الوظيفي لا يمكن أن يكون فارغًا" }, 400, origin);
      if (nextJobNumber.length > 64 || !/^[A-Za-z0-9_-]+$/.test(nextJobNumber)) return json({ error: "الرقم الوظيفي يجب أن يحتوي على أحرف وأرقام و _ أو - فقط وبحد أقصى 64 محرفًا" }, 400, origin);
      const employee = await env.DB.prepare("SELECT id,job_number AS jobNumber,name FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
      if (!employee) return json({ error: "الموظف غير موجود" }, 404, origin);
      const duplicate = await env.DB.prepare("SELECT id FROM employees WHERE job_number=? AND id<>? LIMIT 1").bind(nextJobNumber, employeeId).first<any>();
      if (duplicate) return json({ error: "الرقم الوظيفي مستخدم من موظف آخر" }, 409, origin);
      try {
        await env.DB.prepare("UPDATE employees SET job_number=? WHERE id=?").bind(nextJobNumber, employeeId).run();
      } catch (error) {
        return json({ error: "تعذر تحديث الرقم الوظيفي", detail: error instanceof Error ? error.message : String(error) }, 409, origin);
      }
      const updated = await env.DB.prepare("SELECT id,job_number AS jobNumber,name,status,role,device_id AS deviceId,device_label AS deviceLabel,created_at AS createdAt,schedule_type AS scheduleType,rotation_start_date AS rotationStartDate,work_start_time AS workStartTime,work_end_time AS workEndTime,grace_period_minutes AS gracePeriodMinutes,location_id AS locationId,rotation_days_on AS rotationDaysOn,rotation_days_off AS rotationDaysOff,specialties_json AS specialtiesJson,work_days_json AS workDaysJson,avatar FROM employees WHERE id=? LIMIT 1").bind(employeeId).first<any>();
      await env.DB.prepare("INSERT INTO audit(id,employee_id,job_number,actor_name,action,result,reason,timestamp,device_id,ip) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), employeeId, nextJobNumber, actor.name || "", "employee-job-number-update", "success", `تغيير الرقم الوظيفي من ${employee.jobNumber} إلى ${nextJobNumber}`, new Date().toISOString(), req.headers.get("x-device-id") || "unknown", req.headers.get("CF-Connecting-IP") || "unknown").run().catch(() => undefined);
      return json({ ok: true, employee: updated, previousJobNumber: employee.jobNumber }, 200, origin);
    }
'''
TARGET.write_text(text.replace(marker, patch + marker, 1), encoding="utf-8")
print("job-number patch applied safely")
