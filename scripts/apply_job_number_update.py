from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Production-safe/idempotent: patch only when the exact current route marker exists.
# Never replace a source file wholesale and never touch historical attendance rows.
# V2 also targets the canonical current employee API in backend/src/index.ts.

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

patch_index()
patch_recovery()
