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
const legacyStatusClassExpression =
  'const statusClass = r.status === "PRESENT" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : "";';
const canonicalStatusClassExpression =
  'const statusClass = r.status === "PRESENT" || r.status === "OPEN" ? "present" : r.status === "LATE" ? "late" : r.status === "ABSENT" ? "absent" : r.status === "LEAVE" ? "leave" : r.status === "PERMISSION" ? "permission" : r.status === "ESCAPED" ? "escaped" : r.status === "REST" ? "rest" : r.status === "NOT_STARTED" ? "not-started" : "invalid";';

if (!source.includes(canonicalStatusClassExpression)) {
  replaceOnce(
    legacyStatusClassExpression,
    canonicalStatusClassExpression,
    "print status-class",
  );
}

const legacyStatusExpressions = [
  '<span className={`global-attendance-print-status global-attendance-print-status-${statusClass}`}>{labels[r.status] || r.status}</span>{isRotationShiftFinished(r) && <span className="global-attendance-print-rotation-ended">انتهت المناوبة</span>}',
  '<span className={`global-attendance-print-status global-attendance-print-status-${statusClass}`}>{isRotationShiftFinished(r) ? "انصراف" : labels[r.status] || r.status}</span>',
];
const canonicalStatusExpression =
  '<span className={`global-attendance-print-status global-attendance-print-status-${statusClass}`}>{labels[r.status] || r.status}</span>';

if (!source.includes(canonicalStatusExpression)) {
  const legacyStatus = legacyStatusExpressions.find((value) =>
    source.includes(value),
  );
  if (!legacyStatus) {
    throw new Error(
      "GlobalAttendanceReports status-label patch: expected print status anchor was not found; refusing unsafe replacement.",
    );
  }
  replaceOnce(
    legacyStatus,
    canonicalStatusExpression,
    "print status rendering",
  );
}

const legacyMissingCheckout = 'MISSING_CHECKOUT: "لم يتم تسجيل الانصراف"';
const canonicalMissingCheckout = 'MISSING_CHECKOUT: "انصراف معلق"';
if (!source.includes(canonicalMissingCheckout)) {
  replaceOnce(
    legacyMissingCheckout,
    canonicalMissingCheckout,
    "pending checkout note",
  );
}

const rotationEndedCss =
  '        .global-attendance-print-rotation-ended { display: inline-block !important; margin-inline-start: 1.5mm; border-radius: 9999px; padding: 1mm 2.5mm; background: #ede9fe !important; color: #6d28d9 !important; font-size: 8pt; font-weight: 800; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n';

if (source.includes(rotationEndedCss)) {
  replaceOnce(
    rotationEndedCss,
    "",
    "obsolete rotation-ended print badge CSS",
  );
}

if (
  !source.includes(escapedCanonical) ||
  !source.includes(canonicalStatusClassExpression) ||
  !source.includes(canonicalStatusExpression) ||
  !source.includes(canonicalMissingCheckout) ||
  source.includes("isRotationShiftFinished(r)") ||
  source.includes("global-attendance-print-rotation-ended")
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
  "GlobalAttendanceReports status-label patch: checked-in employees remain PRESENT and pending checkout is shown only in notes.",
);
