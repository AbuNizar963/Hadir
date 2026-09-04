import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

// Android and several share targets treat '/' inside File.name as path
// separators. That is why a filename ending in 04/09/2026 can be displayed
// as only 2026.pdf. Keep the agreed full Arabic filename, but use a filename-
// safe date separator.
const oldDate = '      const displayDate = dayNumber + "/" + monthNumber + "/" + yearNumber;';
const newDate = '      const displayDate = dayNumber + "-" + monthNumber + "-" + yearNumber;';
if (source.includes(oldDate)) source = source.replace(oldDate, newDate);

// Send the same exact filename both as File.name and Web Share title. The
// File remains the authoritative attachment; title is a compatibility hint
// for targets that display the share metadata instead of the attachment name.
const oldShare = '      const shareData = { files: [readyPdf] };';
const newShare = '      const shareData = { files: [readyPdf], title: readyPdf.name };';
if (source.includes(oldShare)) source = source.replace(oldShare, newShare);

if (!source.includes('const displayDate = dayNumber + "-" + monthNumber + "-" + yearNumber;')) {
  throw new Error("ManagerReports safe filename patch: displayDate anchor not found; refusing unsafe replacement.");
}
if (!source.includes('const shareData = { files: [readyPdf], title: readyPdf.name };')) {
  throw new Error("ManagerReports safe filename patch: shareData anchor not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerReports safe filename patch: daily PDF now uses a share-safe full filename and passes it as both File.name and share title.");
