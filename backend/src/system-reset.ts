type ResetEnv = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };
type ResetActor = { id: string; role?: string; name?: string } | null;
const deleteR2Prefix = async (bucket: R2Bucket, prefix: string) => {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) { await bucket.delete(keys); deleted += keys.length; }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
};
export async function handleSystemReset(env: ResetEnv, actor: ResetActor, origin: string): Promise<Response> {
  if (!actor || String(actor.role).toLowerCase() !== "owner") return new Response(JSON.stringify({ ok: false, error: "المالك فقط يستطيع تنفيذ Reset النظام" }), { status: 403, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin } });
  try {
    const sql = [
      "DELETE FROM notifications", "DELETE FROM requests", "DELETE FROM attendance", "DELETE FROM audit",
      "DELETE FROM violations", "DELETE FROM leave_requests", "DELETE FROM tasks", "DELETE FROM performance_reviews",
      "DELETE FROM payroll_entries", "DELETE FROM anomaly_events", "DELETE FROM ai_insights", "DELETE FROM push_subscriptions",
      "DELETE FROM employee_checkout_policies", "DELETE FROM employee_passkeys", "DELETE FROM employee_webauthn_credentials",
      "DELETE FROM employee_webauthn_challenges", "DELETE FROM webauthn_challenges", "DELETE FROM employee_device_events",
      "DELETE FROM auth_sessions WHERE user_type='employee'", "DELETE FROM escape_events", "DELETE FROM employees"
    ];
    await env.DB.batch(sql.map((statement) => env.DB.prepare(statement)));
    const deletedR2Objects = env.PROFILE_IMAGES ? await deleteR2Prefix(env.PROFILE_IMAGES, "employees/") : 0;
    return new Response(JSON.stringify({ ok: true, message: "تمت إعادة تهيئة بيانات التشغيل والاختبار بنجاح. بقيت حسابات الإدارة والإعدادات الأساسية ومواقع العمل محفوظة.", deletedR2Objects, timestamp: new Date().toISOString() }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "تعذر تنفيذ Reset النظام" }), { status: 500, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin } });
  }
}
