import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = "src/pages/GlobalAttendanceReports.tsx";

if (!existsSync(file)) {
  throw new Error(
    "GlobalAttendanceReports status-label patch: source file not found.",
  );
}

let source = readFileSync(file, "utf8");
let changed = false;

const replaceOnce = (value, replacement, description) => {
  if (!source.includes(value)) {
    throw new Error(
      `GlobalAttendanceReports status-label patch: ${description} anchor was not found; refusing unsafe replacement.`,
    );
  }
  source = source.replace(value, replacement);
  changed = true;
};

const escapedCanonical = 'ESCAPED: "هروب"';
const openCanonical = 'OPEN: "حاضر"';

if (!source.includes(escapedCanonical)) {
  const escapedLegacy = [
    'ESCAPED: "انصراف دون تسجيل"',
    'ESCAPED: "هروب من العمل"',
  ].find((value) => source.includes(value));

  if (!escapedLegacy) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected ESCAPED label was not found; refusing unsafe replacement.",
    );
  }

  replaceOnce(escapedLegacy, escapedCanonical, "ESCAPED label");
}

if (!source.includes(openCanonical)) {
  const openLegacy = [
    'OPEN: "دوام مفتوح"',
    'OPEN: "انصراف معلق"',
  ].find((value) => source.includes(value));

  if (!openLegacy) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected OPEN label was not found; refusing unsafe replacement.",
    );
  }

  replaceOnce(openLegacy, openCanonical, "OPEN label");
}

const legacyStatusClassExpression =
  'const statusClass = r.status === "PRESENT" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : "";';
const canonicalStatusClassExpression =
  'const statusClass = r.status === "PRESENT" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : r.status === "ESCAPED" ? "escaped" : r.status === "OPEN" ? "open" : r.status === "REST" ? "rest" : r.status === "NOT_STARTED" ? "not-started" : "invalid";';

if (!source.includes(canonicalStatusClassExpression)) {
  replaceOnce(
    legacyStatusClassExpression,
    canonicalStatusClassExpression,
    "print status-class",
  );
}

const legacyNoteExpressions = [
  '<td>{r.status === "OPEN" ? "لم يتم تسجيل الانصراف" : r.status === "ESCAPED" ? "هروب من العمل" : r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>',
  '<td>{r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>',
];
const canonicalNoteExpression =
  '<td>{r.status === "OPEN" ? "لم يتم تسجيل الانصراف" : r.status === "ESCAPED" ? "هروب من العمل" : (r.status === "LEAVE" || r.status === "PERMISSION") && r.requestReason ? r.requestReason : r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>';

if (!source.includes(canonicalNoteExpression)) {
  const legacyNote = legacyNoteExpressions.find((value) => source.includes(value));
  if (!legacyNote) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected print note anchor was not found; refusing unsafe replacement.",
    );
  }
  replaceOnce(legacyNote, canonicalNoteExpression, "print status-note");
}

const legacyStatusCss =
  '        .global-attendance-print-status-permission { background: #e0f2fe !important; color: #0369a1 !important; }\n';
const canonicalStatusCss =
  `${legacyStatusCss}        .global-attendance-print-status-escaped { background: #7f1d1d !important; color: #fff !important; }\n        .global-attendance-print-status-open { background: #ffedd5 !important; color: #9a3412 !important; }\n        .global-attendance-print-status-rest, .global-attendance-print-status-not-started { background: #e2e8f0 !important; color: #475569 !important; }\n        .global-attendance-print-status-invalid { background: #cbd5e1 !important; color: #334155 !important; }\n        .global-attendance-print-rotation-ended { display: inline-block !important; margin-inline-start: 1.5mm; border-radius: 9999px; padding: 1mm 2.5mm; background: #ede9fe !important; color: #6d28d9 !important; font-size: 8pt; font-weight: 800; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n`;

if (!source.includes(".global-attendance-print-status-escaped")) {
  replaceOnce(
    legacyStatusCss,
    canonicalStatusCss,
    "escaped status CSS",
  );
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
  !source.includes(".global-attendance-print-status-escaped") ||
  !source.includes(".global-attendance-print-status-open") ||
  !source.includes(".global-attendance-print-rotation-ended")
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
  "GlobalAttendanceReports status-label patch: semantic status colors, missing-checkout note, dark-red ESCAPED, and rotation-completion badge applied.",
);
