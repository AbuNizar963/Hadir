type Role = "owner" | "manager" | "supervisor" | "staff";
type Actor = { id: string; name: string; role: Role };
type Env = { DB: D1Database; PROFILE_IMAGES?: R2Bucket };

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["text/csv", ".csv"],
]);

const cors = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type, authorization, x-device-id",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "cache-control": "no-store",
});

const json = (data: unknown, status: number, origin: string) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors(origin), "content-type": "application/json; charset=utf-8" },
});

function canArchive(role: Role) { return role === "owner" || role === "manager"; }

function safeFilename(value: string, fallback: string) {
  const clean = value.replace(/[^\w\-.\u0600-\u06ff ]/g, "_").slice(0, 140).trim();
  return clean || fallback;
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function archiveKey(reportId: string, periodFrom: string, type: string, extension: string) {
  const year = periodFrom.slice(0, 4);
  const month = periodFrom.slice(5, 7);
  return `reports/${year}/${month}/${type}/${reportId}/attendance${extension}`;
}

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

export async function handleReportArchive(req: Request, env: Env, actor: Actor | null, origin: string): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.replace(/\/$/, "").startsWith("/api/reports/archive")) return null;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (!env.PROFILE_IMAGES) return json({ error: "أرشيف التقارير غير مهيأ في بيئة الإنتاج" }, 503, origin);
  if (!actor || !canArchive(actor.role)) return json({ error: "غير مصرح" }, 403, origin);

  const suffix = url.pathname.replace(/^\/api\/reports\/archive\/?/, "");

  if (req.method === "GET") {
    if (suffix) {
      const row = await env.DB.prepare("SELECT report_id,report_type,period_from,period_to,employee_id,generated_at,generated_by,generated_by_name,report_version,data_snapshot_hash,status,file_key,file_name,file_size,mime_type,file_sha256,created_at,locked_at,locked_by,revision FROM report_archives WHERE report_id=? LIMIT 1").bind(suffix).first<any>();
      if (!row) return json({ error: "التقرير المؤرشف غير موجود" }, 404, origin);
      const object = await env.PROFILE_IMAGES.get(String(row.file_key));
      if (!object) return json({ error: "ملف التقرير غير موجود في الأرشيف" }, 404, origin);
      const headers = new Headers({ ...cors(origin), "content-type": String(row.mime_type), "content-disposition": `attachment; filename="${safeFilename(String(row.file_name), "hadir-report")}"`, "cache-control": "private, no-store" });
      headers.set("etag", object.httpEtag);
      headers.set("content-length", String(object.size));
      return new Response(object.body, { status: 200, headers });
    }
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 25)));
    const rows = await env.DB.prepare("SELECT report_id,report_type,period_from,period_to,employee_id,generated_at,generated_by,generated_by_name,report_version,data_snapshot_hash,status,file_name,file_size,mime_type,file_sha256,created_at,locked_at,locked_by,revision FROM report_archives ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return json({ ok: true, reports: rows.results || [] }, 200, origin);
  }

  if (req.method !== "POST" || suffix) return json({ error: "الطريقة غير مدعومة" }, 405, origin);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "ملف التقرير مطلوب" }, 400, origin);
  if (file.size <= 0 || file.size > MAX_ARCHIVE_BYTES) return json({ error: "حجم التقرير يجب ألا يتجاوز 25 ميجابايت" }, 413, origin);

  const mimeType = String(file.type || "").toLowerCase();
  const extension = ALLOWED_TYPES.get(mimeType);
  if (!extension) return json({ error: "نوع ملف التقرير غير مدعوم؛ المسموح PDF أو XLSX أو CSV" }, 415, origin);

  const reportType = String(form?.get("reportType") || "");
  const periodFrom = String(form?.get("periodFrom") || "");
  const periodTo = String(form?.get("periodTo") || "");
  const employeeId = String(form?.get("employeeId") || "").trim() || null;
  const reportVersion = String(form?.get("reportVersion") || "").trim();
  const dataSnapshotHash = String(form?.get("dataSnapshotHash") || "").trim();
  if (!["attendance_daily", "attendance_period", "attendance_employee"].includes(reportType)) return json({ error: "نوع التقرير غير صالح" }, 400, origin);
  if (!validDate(periodFrom) || !validDate(periodTo) || periodFrom > periodTo) return json({ error: "فترة التقرير غير صالحة" }, 400, origin);
  if (!reportVersion || !dataSnapshotHash) return json({ error: "إصدار التقرير وبصمة البيانات مطلوبان للأرشفة" }, 400, origin);

  const reportId = crypto.randomUUID();
  const fileName = safeFilename(String(form?.get("fileName") || `hadir-${periodFrom}-${periodTo}${extension}`), `hadir-report${extension}`);
  const bytes = await file.arrayBuffer();
  const fileSha256 = await sha256Hex(bytes);
  const key = archiveKey(reportId, periodFrom, reportType, extension);
  const generatedAt = String(form?.get("generatedAt") || new Date().toISOString());
  const createdAt = new Date().toISOString();

  await env.PROFILE_IMAGES.put(key, bytes, {
    httpMetadata: { contentType: mimeType, contentDisposition: `attachment; filename="${fileName}"`, cacheControl: "private, no-store" },
    customMetadata: { reportId, reportType, periodFrom, periodTo, generatedBy: actor.id, reportVersion, dataSnapshotHash, fileSha256 },
  });

  try {
    await env.DB.prepare(`INSERT INTO report_archives(report_id,report_type,period_from,period_to,employee_id,generated_at,generated_by,generated_by_name,report_version,data_snapshot_hash,status,file_key,file_name,file_size,mime_type,file_sha256,created_at,revision)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).bind(
      reportId, reportType, periodFrom, periodTo, employeeId, generatedAt, actor.id, actor.name, reportVersion, dataSnapshotHash,
      "CALCULATED", key, fileName, file.size, mimeType, fileSha256, createdAt,
    ).run();
  } catch (error) {
    await env.PROFILE_IMAGES.delete(key).catch(() => undefined);
    return json({ error: "تعذر تسجيل التقرير في سجل الأرشيف", detail: error instanceof Error ? error.message : String(error) }, 409, origin);
  }

  return json({ ok: true, report: { reportId, reportType, periodFrom, periodTo, employeeId, status: "CALCULATED", fileName, fileSize: file.size, mimeType, fileSha256, fileKey: key, generatedAt, generatedBy: actor.id, generatedByName: actor.name, reportVersion, dataSnapshotHash, revision: 1 } }, 201, origin);
}
