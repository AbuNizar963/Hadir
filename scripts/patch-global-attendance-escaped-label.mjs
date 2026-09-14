import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/GlobalAttendanceReports.tsx";

if (!existsSync(file)) {
  throw new Error(
    "GlobalAttendanceReports status-label patch: source file not found.",
  );
}

let source = readFileSync(file, "utf8");

const escapedLabels = [
  'ESCAPED: "انصراف دون تسجيل"',
  'ESCAPED: "هروب من العمل"',
  'ESCAPED: "هروب"',
];
const openLabels = [
  'OPEN: "دوام مفتوح"',
  'OPEN: "انصراف معلق"',
  'OPEN: "حاضر"',
];
const escapedCanonical = 'ESCAPED: "هروب"';
const openCanonical = 'OPEN: "حاضر"';

let changed = false;

const replaceOnce = (value: string, replacement: string, label: string) => {
  if (!source.includes(value)) return false;
  source = source.replace(value, replacement);
  changed = true;
  return true;
};

if (!source.includes(escapedCanonical)) {
  const previous = escapedLabels.find((value) => source.includes(value));
  if (!previous) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected ESCAPED label was not found; refusing unsafe replacement.",
    );
  }
  replaceOnce(previous, escapedCanonical, "ESCAPED");
}

if (!source.includes(openCanonical)) {
  const previous = openLabels.find((value) => source.includes(value));
  if (!previous) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected OPEN label was not found; refusing unsafe replacement.",
    );
  }
  replaceOnce(previous, openCanonical, "OPEN");
}

const legacyStatusClassExpression =
  'const statusClass = r.status === "PRESENT" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : "";';
const canonicalStatusClassExpression =
  'const statusClass = r.status === "PRESENT" || r.status === "OPEN" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : r.status === "ESCAPED" ? "escaped" : "";';

if (!source.includes(canonicalStatusClassExpression)) {
  if (!replaceOnce(legacyStatusClassExpression, canonicalStatusClassExpression, "status classes")) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected print status-class expression was not found; refusing unsafe replacement.",
    );
  }
}

const legacyNoteExpression =
  '<td>{r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>';
const canonicalNoteExpression =
  '<td>{r.status === "OPEN" ? "لم يتم تسجيل الانصراف" : r.status === "ESCAPED" ? "هروب من العمل" : r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>';

if (!source.includes(canonicalNoteExpression)) {
  if (!replaceOnce(legacyNoteExpression, canonicalNoteExpression, "status notes")) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected print note expression was not found; refusing unsafe replacement.",
    );
  }
}

const escapedStyleAnchor =
  '        .global-attendance-print-status-permission { background: #e0f2fe !important; color: #0369a1 !important; }\\n';
const escapedStyle =
  '        .global-attendance-print-status-permission { background: #e0f2fe !important; color: #0369a1 !important; }\\n        .global-attendance-print-status-escaped { background: #fecaca !important; color: #7f1d1d !important; }\\n';

if (!source.includes('.global-attendance-print-status-escaped')) {
  if (!replaceOnce(escapedStyleAnchor, escapedStyle, "escaped status style")) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected print status CSS anchor was not found; refusing unsafe replacement.",
    );
  }
}

const escapedCount = (source.match(/ESCAPED:/g) || []).length;
const openCount = (source.match(/OPEN:/g) || []).length;

if (
  escapedCount !== 1 ||
  openCount !== 1 ||
  !source.includes(escapedCanonical) ||
  !source.includes(openCanonical) ||
  !source.includes(canonicalStatusClassExpression) ||
  !source.includes(canonicalNoteExpression) ||
  !source.includes('.global-attendance-print-status-escaped')
) {
  throw new Error(
    "GlobalAttendanceReports status-label patch: replacement validation failed.",
  );
}

if (!changed) {
  console.log(
    "GlobalAttendanceReports status-label patch: already applied.",
  );
  process.exit(0);
}

writeFileSync(file, source, "utf8");
console.log(
  "GlobalAttendanceReports status-label patch: OPEN=حاضر, missing checkout note=لم يتم تسجيل الانصراف, ESCAPED=هروب with a darker red style and note=هروب من العمل.",
);
