type Env = { DB: D1Database };
type Actor = { id: string; name?: string; role: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export async function handleWorkforceControls(request: Request, env: Env, actor: Actor | null) {
  if (request.method !== "PATCH") return null;
  if (!actor || actor.role !== "owner") return json({ error: "المالك فقط يستطيع تعديل إعدادات Workforce" }, 403);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const employeeId = String(body.employeeId || "").trim();
  if (!employeeId) return json({ error: "رقم الموظف مطلوب" }, 400);

  const current = await env.DB.prepare(
    "SELECT id,job_number AS jobNumber,name,status,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees WHERE id=? LIMIT 1"
  ).bind(employeeId).first<any>();
  if (!current) return json({ error: "الموظف غير موجود" }, 404);

  const allowed: Array<[string, string]> = [
    ["isVip", "is_vip"],
    ["autoCheckIn", "auto_check_in"],
    ["autoCheckOut", "auto_check_out"],
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of allowed) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return json({ error: `${key} يجب أن تكون true أو false` }, 400);
      sets.push(`${column}=?`);
      values.push(body[key] ? 1 : 0);
    }
  }
  if (!sets.length) return json({ error: "لا توجد تغييرات" }, 400);

  values.push(employeeId);
  try {
    const result = await env.DB.prepare(`UPDATE employees SET ${sets.join(",")} WHERE id=?`).bind(...values).run();
    if (!result.meta.changes) return json({ error: "لم يتم تطبيق التغيير في D1" }, 409);

    const saved = await env.DB.prepare(
      "SELECT id,job_number AS jobNumber,name,status,is_vip AS isVip,auto_check_in AS autoCheckIn,auto_check_out AS autoCheckOut FROM employees WHERE id=? LIMIT 1"
    ).bind(employeeId).first<any>();
    if (!saved) return json({ error: "تم التحديث لكن تعذر التحقق من البيانات في D1" }, 500);

    const expected = ["isVip", "autoCheckIn", "autoCheckOut"] as const;
    for (const key of expected) {
      if (body[key] !== undefined && Boolean(saved[key]) !== Boolean(body[key])) {
        return json({ error: `تم رفض التغيير: لم تتطابق قيمة ${key} بعد القراءة من D1` }, 500);
      }
    }

    return json({ ok: true, employee: saved });
  } catch (error) {
    return json({ error: "تعذر حفظ إعدادات Workforce في D1", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
}
