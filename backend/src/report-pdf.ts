const MAX_HTML_BYTES = 12 * 1024 * 1024;
const MAX_CSS_BYTES = 8 * 1024 * 1024;
const MAX_LOGO_BACKUP_LENGTH = 140000;

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

async function resolveCompanyLogoKey(env: BrowserEnv): Promise<string> {
  const rows = await env.DB.prepare("SELECT key,value FROM settings WHERE key IN (?,?)")
    .bind("brandLogoR2Key", "brandLogo")
    .all<{ key: string; value: string }>();
  const settings = new Map((rows.results || []).map((row) => [String(row.key), String(row.value || "").trim()]));

  const storedKey = settings.get("brandLogoR2Key") || "";
  if (storedKey) {
    const current = await env.PROFILE_IMAGES!.head(storedKey);
    if (current) return storedKey;
  }

  // Older production data may already have the R2-backed /api/company/logo URL
  // saved in brandLogo while brandLogoR2Key was never written. That URL carries
  // the exact immutable R2 object key in ?v=..., so recover and persist it.
  const configuredUrl = settings.get("brandLogo") || "";
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      const candidate = String(parsed.searchParams.get("v") || "").trim();
      if (candidate) {
        const recovered = await env.PROFILE_IMAGES!.head(candidate);
        if (recovered) {
          await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
            .bind("brandLogoR2Key", candidate)
            .run();
          return candidate;
        }
      }
    } catch {
      // Ignore malformed legacy URL and report the real storage problem below.
    }
  }

  if (storedKey) throw new Error("مفتاح شعار الشركة موجود في الإعدادات لكن ملف الشعار غير موجود في R2");
  throw new Error("لم يتم العثور على شعار الشركة في R2 أو على مفتاح R2 محفوظ في الإعدادات");
}

async function getCompanyLogoBackup(env: BrowserEnv): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1")
    .bind("brandLogoDataUrl")
    .first<{ value: string }>();
  const value = String(row?.value || "").trim();
  if (!value || value.length > MAX_LOGO_BACKUP_LENGTH) return null;
  return /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/i.test(value) ? value : null;
}

function hasEmbeddedCompanyLogo(html: string): boolean {
  return /<img\b[^>]*\balt=["']شعار الشركة["'][^>]*\bsrc=["']data:image\//i.test(html)
    || /<img\b[^>]*\bsrc=["']data:image\/[^"']+["'][^>]*\balt=["']شعار الشركة["']/i.test(html);
}

async function embedCurrentCompanyLogo(html: string, env: BrowserEnv): Promise<string> {
  // The report page already renders the current Settings logo. The browser
  // client inlines that exact image before calling this endpoint, so PDF
  // generation can use the same current logo even if an old R2 pointer is
  // temporarily missing. R2 remains the authoritative storage for future
  // uploads and the fallback when the client did not inline the image.
  if (hasEmbeddedCompanyLogo(html)) return html;

  // Since the logo is now backed up in D1 at save time, a PDF never needs to
  // fail merely because an older R2 object was lost. This is the durable PDF
  // path; R2 remains the primary binary store for the application.
  const backup = await getCompanyLogoBackup(env);
  if (backup) {
    const logoMarkup = `<img src="${backup}" alt="" style="width:31mm;height:31mm;max-width:31mm;max-height:31mm;object-fit:contain;display:block;margin:0 auto 8px auto;" />`;
    const logoTagPattern = /<img\b[^>]*\balt=["']شعار الشركة["'][^>]*>/i;
    if (logoTagPattern.test(html)) return html.replace(logoTagPattern, logoMarkup);
    const serviceReportPattern = /(<[^>]+class=["'][^"']*\bservice-report\b[^"']*["'][^>]*>)/i;
    if (!serviceReportPattern.test(html)) throw new Error("لم يتم العثور على حاوية التقرير لإضافة شعار الشركة");
    return html.replace(serviceReportPattern, `$1<div class="pdf-company-logo" dir="rtl">${logoMarkup}</div>`);
  }

  if (!env.PROFILE_IMAGES) throw new Error("R2 binding PROFILE_IMAGES غير موجود أثناء تجهيز PDF");

  const key = await resolveCompanyLogoKey(env);
  const object = await env.PROFILE_IMAGES.get(key);
  if (!object) throw new Error("لم يتم العثور على شعار الشركة في R2 بعد استعادة مفتاحه");

  const bytes = new Uint8Array(await object.arrayBuffer());
  if (!bytes.length) throw new Error("ملف شعار الشركة في R2 فارغ");

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  const contentType = String(object.httpMetadata?.contentType || "image/webp").toLowerCase();
  const dataUrl = `data:${contentType};base64,${btoa(binary)}`;
  const logoMarkup = `<img src="${dataUrl}" alt="" style="width:31mm;height:31mm;max-width:31mm;max-height:31mm;object-fit:contain;display:block;margin:0 auto 8px auto;" />`;

  const logoTagPattern = /<img\b[^>]*\balt=["']شعار الشركة["'][^>]*>/i;
  if (logoTagPattern.test(html)) return html.replace(logoTagPattern, logoMarkup);

  const serviceReportPattern = /(<[^>]+class=["'][^"']*\bservice-report\b[^"']*["'][^>]*>)/i;
  if (!serviceReportPattern.test(html)) throw new Error("لم يتم العثور على حاوية التقرير لإضافة شعار الشركة");
  return html.replace(serviceReportPattern, `$1<div class="pdf-company-logo" dir="rtl">${logoMarkup}</div>`);
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
