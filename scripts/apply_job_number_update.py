from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Production-safe/idempotent: patch only when exact current markers exist.
# Never replace source files wholesale and never touch historical attendance rows.

def patch_index():
    target = ROOT / "backend/src/index.ts"
    text = target.read_text(encoding="utf-8")
    if "JOB_NUMBER_UPDATE_PATCH_V2" in text:
        print("index job-number patch already present")
        return
    marker = 'if(path==="/api/employees"&&req.method==="GET")'
    if marker not in text:
        raise SystemExit("Refusing unsafe patch: current employees GET route marker was not found in index.ts")
    patch = r'''/* JOB_NUMBER_UPDATE_PATCH_V2 */
if(path.startsWith("/api/employees/")&&req.method==="PATCH"&&!path.endsWith("/device")&&!path.endsWith("/avatar")){
  if(!canWrite(actor.role))return json({error:"لا تملك صلاحية الكتابة"},403,origin);
  const id=decodeURIComponent(path.split("/").pop()||"");
  const b=await body(req);
  if(b.jobNumber===undefined)return json({error:"لم يتم إرسال الرقم الوظيفي"},400,origin);
  const nextJobNumber=String(b.jobNumber||"").trim();
  if(!nextJobNumber)return json({error:"الرقم الوظيفي لا يمكن أن يكون فارغًا"},400,origin);
  if(nextJobNumber.length>64||!/^[A-Za-z0-9_-]+$/.test(nextJobNumber))return json({error:"الرقم الوظيفي يجب أن يحتوي على أحرف وأرقام و _ أو - فقط وبحد أقصى 64 محرفًا"},400,origin);
  const current=await env.DB.prepare("SELECT id,job_number AS jobNumber FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
  if(!current)return json({error:"الموظف غير موجود"},404,origin);
  if(String(current.jobNumber)===nextJobNumber){const same=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();return json({ok:true,employee:employeeOut(same),previousJobNumber:current.jobNumber},200,origin);}
  const duplicate=await env.DB.prepare("SELECT id FROM employees WHERE job_number=? AND id<>? LIMIT 1").bind(nextJobNumber,id).first<any>();
  if(duplicate)return json({error:"الرقم الوظيفي مستخدم من موظف آخر"},409,origin);
  try{await env.DB.prepare("UPDATE employees SET job_number=? WHERE id=?").bind(nextJobNumber,id).run();}
  catch(error){return json({error:"تعذر تحديث الرقم الوظيفي",detail:error instanceof Error?error.message:String(error)},409,origin);}
  const updated=await env.DB.prepare("SELECT * FROM employees WHERE id=? LIMIT 1").bind(id).first<any>();
  await audit(env,req,actor.name,"employee-job-number-update","success",id,nextJobNumber,`تغيير الرقم الوظيفي من ${current.jobNumber} إلى ${nextJobNumber}`);
  return json({ok:true,employee:employeeOut(updated),previousJobNumber:current.jobNumber},200,origin);
}
'''
    target.write_text(text.replace(marker, patch + marker, 1), encoding="utf-8")
    print("index job-number patch applied")


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
