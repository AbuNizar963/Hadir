import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ReportArchive.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const oldImport = 'import { archiveReportFile, archivedReportUrl, listArchivedReports } from "@/lib/reportArchive";';
const newImport = 'import { archiveReportFile, archivedReportUrl, deleteArchivedReport, listArchivedReports } from "@/lib/reportArchive";';
if (!source.includes(oldImport) && !source.includes("deleteArchivedReport")) throw new Error("ReportArchive: archive import anchor not found.");
source = source.replace(oldImport, newImport);

const oldIcon = 'import { Archive, Download, FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";';
const newIcon = 'import { Archive, Download, FileSpreadsheet, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";';
if (!source.includes(oldIcon) && !source.includes("Trash2")) throw new Error("ReportArchive: icon import anchor not found.");
source = source.replace(oldIcon, newIcon);

const oldActions = '<a className="font-semibold text-primary underline" href={archivedReportUrl(String(x.report_id))} target="_blank" rel="noreferrer"><Download className="mr-1 inline h-4 w-4" />تنزيل</a>';
const newActions = '<a className="font-semibold text-primary underline" href={archivedReportUrl(String(x.report_id))} target="_blank" rel="noreferrer"><Download className="mr-1 inline h-4 w-4" />تنزيل</a><Button variant="ghost" size="sm" className="text-destructive" disabled={saving} onClick={async () => { if (!window.confirm("هل تريد حذف هذا التقرير من الأرشيف نهائيًا؟")) return; setSaving(true); setError(null); setMessage(null); try { await deleteArchivedReport(String(x.report_id)); setMessage("تم حذف التقرير من الأرشيف."); await refreshArchives(); } catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف التقرير"); } finally { setSaving(false); } }}><Trash2 className="mr-1 inline h-4 w-4" />حذف</Button>';
if (!source.includes(oldActions) && !source.includes("حذف التقرير من الأرشيف")) throw new Error("ReportArchive: archive row action anchor not found.");
source = source.replace(oldActions, newActions);

if (!source.includes("deleteArchivedReport") || !source.includes("حذف</Button>")) throw new Error("ReportArchive: delete action was not applied.");
writeFileSync(file, source, "utf8");
console.log("ReportArchive patch: added manager/owner archive deletion action.");
