const CANONICAL_API_URL = "https://hadir-api.abunizar963.workers.dev";
const API_URL = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "") || CANONICAL_API_URL;
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";

export async function generateProfessionalReportPdf(html: string, css: string, filename: string): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("تصدير PDF متاح من المتصفح فقط.");
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  if (!token) throw new Error("انتهت جلسة الإدارة. سجّل الدخول ثم أعد المحاولة.");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${API_URL}/api/reports/daily/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ html, css, filename }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: unknown; detail?: unknown };
      const errorText = typeof data.error === "string" ? data.error : `فشل إنشاء ملف PDF (${response.status})`;
      const detailText = typeof data.detail === "string" && data.detail.trim() ? `: ${data.detail.trim()}` : "";
      throw new Error(`${errorText}${detailText}`);
    }
    const blob = await response.blob();
    if (!blob.size || blob.type && !blob.type.toLowerCase().includes("pdf")) throw new Error("الخادم أعاد ملف PDF غير صالح.");
    return blob;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("انتهت مهلة تجهيز PDF. أعد المحاولة بعد لحظات.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
