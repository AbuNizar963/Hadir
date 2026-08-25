type AIModel = { run(model: string, input: Record<string, unknown>): Promise<any> };

type Env = { AI?: AIModel };

function trimText(value: unknown, max = 12000) {
  return String(value ?? "").slice(0, max);
}

function buildPrompt(role: "manager" | "employee", question: string, data: unknown) {
  const scope = role === "manager"
    ? "أنت مساعد مدير داخل نظام حضور. تستطيع تحليل بيانات الموظفين المرسلة لك ضمن صلاحية المدير. لا تكشف أسرارًا أو كلمات مرور أو رموز دخول أو معرفات أجهزة. لا تخترع أرقامًا غير موجودة في البيانات. إذا لم تكف البيانات قل ذلك بوضوح."
    : "أنت مساعد موظف داخل نظام حضور. تستطيع تحليل بيانات هذا الموظف فقط. ممنوع كشف أو تخمين بيانات أي موظف آخر، وممنوع اختراع غياب مؤكد من عدم وجود سجل حضور فقط. لا تكشف كلمات المرور أو رموز الدخول أو معرفات الأجهزة.";
  return `${scope}\nأجب بالعربية وباختصار مفيد. السؤال: ${trimText(question, 1000)}\nبيانات النظام المسموح بها:\n${trimText(JSON.stringify(data), 18000)}`;
}

export async function handleAI(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env.AI) return Response.json({ ok: false, available: false, error: "Workers AI غير مفعّل" }, { status: 503 });
  const body = await request.json().catch(() => null) as any;
  const role = body?.role === "manager" ? "manager" : "employee";
  const question = trimText(body?.question, 1000).trim();
  if (!question) return Response.json({ ok: false, error: "السؤال فارغ" }, { status: 400 });
  const prompt = buildPrompt(role, question, body?.data ?? {});
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: role === "manager" ? "أنت مساعد تحليلي عربي لنظام Hadir. استخدم البيانات فقط." : "أنت مساعد شخصي عربي لنظام Hadir. استخدم بيانات الموظف فقط." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.2
    });
    const text = String(result?.response ?? result?.result?.response ?? "").trim();
    if (!text) return Response.json({ ok: false, available: true, error: "لم ينتج النموذج إجابة" }, { status: 502 });
    return Response.json({ ok: true, provider: "cloudflare-workers-ai", text }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, available: true, error: error instanceof Error ? error.message : "فشل تشغيل الذكاء الاصطناعي" }, { status: 502 });
  }
}
