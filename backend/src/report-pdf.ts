const MAX_HTML_BYTES = 12 * 1024 * 1024;
const MAX_CSS_BYTES = 8 * 1024 * 1024;

// The PDF renderer runs in Cloudflare Browser Run. Resolve the current logo
// inside the Worker from D1 + R2, then embed the bytes into the HTML. This
// avoids browser cookies, CORS, stale URLs, and external-image timing issues.
type BrowserEnv = { BROWSER?: BrowserRun; DB: D1Database; PROFILE_IMAGES?: R2Bucket };

type PdfPayload = {
  html?: unknown;
  css?: unknown;
  filename?: unknown;
};

const cors = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type, authorization, x-device-id",
  "access-control-allow-methods": "POST,OPTIONS",
});

async function embedCurrentCompanyLogo(html: string, env: BrowserEnv): Promise<string> {
  if (!env.PROFILE_IMAGES || !html.includes('alt="شعار الشركة"')) return html;

  const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1")
    .bind("brandLogoR2Key")
    .first<{ value: string }>();
  const key = String(row?.value || "").trim();
  if (!key) return html;

  const object = await env.PROFILE_IMAGES.get(key);
  if (!object) return html;

  const bytes = new Uint8Array(await object.arrayBuffer());
  if (!bytes.length) return html;

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  const dataUrl = `data:image/webp;base64,${btoa(binary)}`;

  // Only replace the source of the company-logo image. The rest of the report
  // remains byte-for-byte unchanged before Chromium renders it.
  return html.replace(/(<img\b[^>]*alt=["']شعار الشركة["'][^>]*\bsrc=["'])([^"']*)(["'])/i, `$1${dataUrl}$3`)
    .replace(/(<img\b[^>]*\bsrc=["'])([^"']*)(["'][^>]*alt=["']شعار الشركة["'])/i, `$1${dataUrl}$3`);
}

export async function generateDailyReportPdf(req: Request, env: BrowserEnv, responseOrigin: string): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(responseOrigin) });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "الطريقة غير مدعومة" }), { status: 405, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8" } });
  if (!env.BROWSER) return new Response(JSON.stringify({ error: "خدمة إنشاء PDF غير مفعلة في بيئة الإنتاج" }), { status: 503, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

  const body = await req.json().catch(() => null) as PdfPayload | null;
  const html = typeof body?.html === "string" ? body.html : "";
  const css = typeof body?.css === "string" ? body.css : "";
  const requestedFilename = typeof body?.filename === "string" ? body.filename : "hadir-daily-report.pdf";
  const filename = requestedFilename.replace(/[^\w\-.\u0600-\u06ff ]/g, "_").slice(0, 120) || "hadir-daily-report.pdf";

  if (!html || !html.includes("service-report")) return new Response(JSON.stringify({ error: "محتوى تقرير PDF غير صالح" }), { status: 400, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8" } });
  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES || new TextEncoder().encode(css).byteLength > MAX_CSS_BYTES) return new Response(JSON.stringify({ error: "حجم تقرير PDF أكبر من الحد المسموح" }), { status: 413, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8" } });
  if (/<\/?(script|iframe|object|embed)\b/i.test(html) || /javascript\s*:/i.test(html)) return new Response(JSON.stringify({ error: "محتوى PDF غير مسموح" }), { status: 400, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8" } });

  try {
    const renderedHtml = await embedCurrentCompanyLogo(html, env);
    const rendered = await env.BROWSER.quickAction("pdf", {
      html: renderedHtml,
      addStyleTag: css ? [{ content: css }] : [],
      gotoOptions: { waitUntil: "load", timeout: 60000 },
      waitForSelector: { selector: ".service-report", visible: true, timeout: 60000 },
      pdfOptions: {
        format: "a4",
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        scale: 1,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        timeout: 90000,
      },
      actionTimeout: 90000,
    });
    if (!rendered.ok) {
      const detail = await rendered.text().catch(() => "");
      return new Response(JSON.stringify({ error: "تعذر إنشاء PDF", detail: detail.slice(0, 1000) }), { status: 502, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
    return new Response(rendered.body, {
      status: 200,
      headers: {
        ...cors(responseOrigin),
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename.replace(/[^\x20-\x7E]/g, "_")}"`,
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "تعذر إنشاء PDF", detail: error instanceof Error ? error.message : String(error) }), { status: 502, headers: { ...cors(responseOrigin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
}
