from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# Production-safe/idempotent: normalize only the exact job-number patch route.
# Never replace source files wholesale and never touch historical attendance rows.

def patch_index():
    target = ROOT / "backend/src/index.ts"
    text = target.read_text(encoding="utf-8")

    # The original employee PATCH route already contains the complete, identity-safe
    # jobNumber update logic. V2 was inserted immediately after it, making V2
    # unreachable and leaving duplicate PATCH handlers in the source. Remove only
    # that exact marked block; fail closed if the marker shape is unexpected.
    marker = "/* JOB_NUMBER_UPDATE_PATCH_V2 */"
    if marker in text:
        start = text.index(marker)
        end_marker = 'if(path==="/api/employees"&&req.method==="GET")'
        end = text.find(end_marker, start)
        if end == -1:
            raise SystemExit("Refusing unsafe cleanup: V2 route end marker was not found")
        text = text[:start] + text[end:]
        target.write_text(text, encoding="utf-8")
        print("duplicate V2 job-number route removed")
    else:
        print("duplicate V2 job-number route already absent")


def patch_recovery():
    target = ROOT / "backend/src/recovery.ts"
    text = target.read_text(encoding="utf-8")
    if "JOB_NUMBER_UPDATE_PATCH_V1" in text:
        print("recovery job-number patch already present")
        return
    marker = '    if (path.match(/^\\/api\\/employees\\/[^/]+\\/avatar$/)) {'
    if marker not in text:
        print("recovery employee route marker absent; leaving recovery.ts unchanged")
        return
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
      await env.DB.prepare("UPDATE employees SET job_number=? WHERE id=?").bind(nextJobNumber, employeeId).run();
      return json({ ok: true, previousJobNumber: employee.jobNumber }, 200, origin);
    }
'''
    target.write_text(text.replace(marker, patch + marker, 1), encoding="utf-8")
    print("recovery job-number patch applied")


def patch_keyboard_fields():
    # Stage 4: only remove an inappropriate numeric keyboard hint from mixed
    # alphanumeric identifiers. Exact-marker checks make this fail closed.
    manager = ROOT / "src/pages/ManagerEmployees.tsx"
    text = manager.read_text(encoding="utf-8")
    old = 'inputMode="numeric" placeholder="مثال: 1000" value={form.jobNumber} disabled={!!editingId}'
    new = 'inputMode="text" autoComplete="off" placeholder="مثال: D718075" value={form.jobNumber}'
    if old in text:
        text = text.replace(old, new, 1)
        manager.write_text(text, encoding="utf-8")
        print("manager employee job-number keyboard/inputMode patched")
    elif 'inputMode="text" autoComplete="off" placeholder="مثال: D718075" value={form.jobNumber}' in text:
        print("manager employee job-number keyboard patch already present")
    else:
        raise SystemExit("Refusing unsafe keyboard patch: ManagerEmployees job-number marker was not found")

    login = ROOT / "src/pages/EmployeeLogin.tsx"
    text = login.read_text(encoding="utf-8")
    old = 'type="text" inputMode="numeric" autoComplete="username" className="input w-full p-3.5 rounded-2xl border border-border bg-secondary/45 text-base" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} placeholder="مثال: 1001"'
    new = 'type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" className="input w-full p-3.5 rounded-2xl border border-border bg-secondary/45 text-base" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} placeholder="مثال: D718075"'
    if old in text:
        text = text.replace(old, new, 1)
        login.write_text(text, encoding="utf-8")
        print("employee login job-number keyboard/inputMode patched")
    elif 'type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off"' in text:
        print("employee login job-number keyboard patch already present")
    else:
        raise SystemExit("Refusing unsafe keyboard patch: EmployeeLogin job-number marker was not found")


patch_index()
patch_recovery()
patch_keyboard_fields()
