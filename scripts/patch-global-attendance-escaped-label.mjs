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
  'const statusClass = r.status === "PRESENT" || r.status === "OPEN" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : r.status === "ESCAPED" ? "escaped" : "";';

if (!source.includes(canonicalStatusClassExpression)) {
  replaceOnce(
    legacyStatusClassExpression,
    canonicalStatusClassExpression,
    "print status-class",
  );
}

const legacyNoteExpression =
  '<td>{r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>';
const canonicalNoteExpression =
  '<td>{r.status === "OPEN" ? "لم يتم تسجيل الانصراف" : r.status === "ESCAPED" ? "هروب من العمل" : r.exceptionCode ? (noteLabels[r.exceptionCode] || r.exceptionCode) : "—"}</td>';

if (!source.includes(canonicalNoteExpression)) {
  replaceOnce(
    legacyNoteExpression,
    canonicalNoteExpression,
    "print status-note",
  );
}

const legacyStatusCss =
  '        .global-attendance-print-status-permission { background: #e0f2fe !important; color: #0369a1 !important; }\n';
const canonicalStatusCss =
  `${legacyStatusCss}        .global-attendance-print-status-escaped { background: #fecaca !important; color: #7f1d1d !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; box-sizing: border-box !important; min-width: 42px !important; min-height: 24px !important; padding: 2px 8px !important; border-radius: 9999px !important; font-size: 11px !important; font-weight: 700 !important; line-height: 1.25 !important; }\n`;

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
  !source.includes("min-width: 42px") ||
  !source.includes("min-height: 24px")
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
  "GlobalAttendanceReports status-label patch: OPEN=حاضر, missing checkout note=لم يتم تسجيل الانصراف, ESCAPED=هروب with a matching 42x24 status pill and darker red background, escaped note=هروب من العمل.",
);
