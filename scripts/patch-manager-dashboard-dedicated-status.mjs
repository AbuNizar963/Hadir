import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerDashboard.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerDashboard dedicated status patch: ${message}; refusing unsafe replacement.`); };

const importAnchor = 'import { getBackendEscapeEvents } from "@/lib/backend";';
if (!source.includes(importAnchor)) fail("backend escape import anchor not found");
source = source.replace(importAnchor, 'import { getBackendEscapeEvents, getBackendRequests } from "@/lib/backend";');
const typeAnchor = 'import ManagerLayout from "@/components/layout/ManagerLayout";';
if (!source.includes(typeAnchor)) fail("ManagerLayout import anchor not found");
source = source.replace(typeAnchor, `${typeAnchor}\nimport type { EmployeeRequest } from "@/types";`);

const stateAnchor = 'const [filter, setFilter] = useState<Filter>("all");';
if (!source.includes(stateAnchor)) fail("filter state anchor not found");
source = source.replace(stateAnchor, `${stateAnchor}\n  const [dashboardHome, setDashboardHome] = useState(true);\n  const [permissionRequests, setPermissionRequests] = useState<EmployeeRequest[]>([]);`);

const statusSectionStart = '      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="حالات الدوام">';
const employeeSectionStart = '      <section className="hud-card p-5">';
const statusSectionIndex = source.indexOf(statusSectionStart);
const employeeSectionIndex = source.indexOf(employeeSectionStart, statusSectionIndex);
if (statusSectionIndex < 0 || employeeSectionIndex < 0) fail("dashboard status/employee section anchors not found");

const statusSectionEnd = '      </section>\n\n';
const statusEndIndex = source.indexOf(statusSectionEnd, statusSectionIndex);
if (statusEndIndex < 0 || statusEndIndex > employeeSectionIndex) fail("dashboard status section end not found");

const statusBlock = source.slice(statusSectionIndex, statusEndIndex + statusSectionEnd.length);
const employeeEndMarker = '      </section>\n    </ManagerLayout>';
const employeeEndIndex = source.indexOf(employeeEndMarker, employeeSectionIndex);
if (employeeEndIndex < 0) fail("dashboard employee section end not found");
const employeeBlock = source.slice(employeeSectionIndex, employeeEndIndex + '      </section>'.length);

const loadAnchor = '          getBackendEscapeEvents(undefined, 2000),';
if (!source.includes(loadAnchor)) fail("escape events load anchor not found");
source = source.replace(loadAnchor, `${loadAnchor}\n          getBackendRequests("admin"),`);
const setEscapeAnchor = '        setEscapeEvents(Array.isArray(escapes) ? escapes.map((item) => ({ employeeId: String(item.employeeId), status: item.status })) : []);';
if (!source.includes(setEscapeAnchor)) fail("escape events state anchor not found");
source = source.replace(setEscapeAnchor, `${setEscapeAnchor}\n        setPermissionRequests(Array.isArray(requests) ? requests : []);`);

const permissionMemoAnchor = '  const escapedIds = useMemo(() => {';
const permissionMemoIndex = source.indexOf(permissionMemoAnchor);
if (permissionMemoIndex < 0) fail("escaped ids memo anchor not found");
const permissionMemo = `  const permissionIds = useMemo(() => {\n    const toDamascusDate = (value: string) => {\n      const parsed = new Date(value);\n      if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10);\n      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);\n    };\n    return new Set(permissionRequests\n      .filter((request) => request.type === "permission" && (request.status === "approved" || request.status === "confirmed"))\n      .filter((request) => {\n        const start = request.startDate || toDamascusDate(request.createdAt);\n        const end = request.endDate || start;\n        return start <= today && end >= today;\n      })\n      .map((request) => request.employeeId));\n  }, [permissionRequests, today]);\n\n`;
source = source.slice(0, permissionMemoIndex) + permissionMemo + source.slice(permissionMemoIndex);

const filteredPermissionAnchor = '    if (filter === "leave" && !leaveIds.has(id)) return false;';
if (!source.includes(filteredPermissionAnchor)) fail("leave filter anchor not found");
source = source.replace(filteredPermissionAnchor, `${filteredPermissionAnchor}\n    if (filter === "permission" && !permissionIds.has(id)) return false;`);
const dependencyAnchor = '[currentRows, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds, escapedIds]);';
if (!source.includes(dependencyAnchor)) fail("filtered rows dependency anchor not found");
source = source.replace(dependencyAnchor, '[currentRows, search, filter, presentIds, absentIds, lateIds, restIds, leaveIds, permissionIds, escapedIds]);');

const filterTypeAnchor = 'type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave" | "escaped";';
const toneTypeAnchor = 'type Tone = "all" | "present" | "absent" | "late" | "rest" | "leave" | "escaped";';
if (!source.includes(filterTypeAnchor) || !source.includes(toneTypeAnchor)) fail("filter/tone type anchors not found");
source = source.replace(filterTypeAnchor, 'type Filter = "all" | "present" | "absent" | "late" | "rest" | "leave" | "permission" | "escaped";');
source = source.replace(toneTypeAnchor, 'type Tone = "all" | "present" | "absent" | "late" | "rest" | "leave" | "permission" | "escaped";');

const filtersAnchor = '["late", "المتأخرون"], ["rest", "المستريحون"], ["leave", "الإجازات"], ["escaped", "الهاربون"],';
if (!source.includes(filtersAnchor)) fail("filters list anchor not found");
source = source.replace(filtersAnchor, '["late", "المتأخرون"], ["rest", "المستريحون"], ["leave", "الإجازات"], ["permission", "المستأذنون"], ["escaped", "الهاربون"],');

const updatedStatusBlock = statusBlock
  .replaceAll('onClick={() => setFilter("all")}', 'onClick={() => { setFilter("all"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("present")}', 'onClick={() => { setFilter("present"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("absent")}', 'onClick={() => { setFilter("absent"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("late")}', 'onClick={() => { setFilter("late"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("rest")}', 'onClick={() => { setFilter("rest"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("leave")}', 'onClick={() => { setFilter("leave"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("escaped")}', 'onClick={() => { setFilter("escaped"); setDashboardHome(false); }}');

const permissionShortcutAnchor = '<StatusShortcut label="الهروب" value={escapedIds.size} icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />} tone="escaped" onClick={() => { setFilter("escaped"); setDashboardHome(false); }} active={filter === "escaped"} />';
if (!updatedStatusBlock.includes(permissionShortcutAnchor)) fail("escaped status shortcut anchor not found");
const permissionShortcut = `${permissionShortcutAnchor}\n        <StatusShortcut label="الاستئذان" value={permissionIds.size} icon={<PermissionIcon />} tone="permission" onClick={() => { setFilter("permission"); setDashboardHome(false); }} active={filter === "permission"} />`;
const finalStatusBlock = updatedStatusBlock.replace(permissionShortcutAnchor, permissionShortcut);

const detailHeader = `      {!dashboardHome ? <section className="hud-card mb-5 p-4 sm:p-5">\n        <div className="flex items-center gap-3">\n          <button type="button" onClick={() => setDashboardHome(true)} aria-label="العودة إلى لوحة حالات الدوام" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-secondary text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">\n            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>\n          </button>\n          <div className="min-w-0 flex-1">\n            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary mono">STATUS LIST</div>\n            <h2 className="mt-1 text-xl font-black">{filters.find(([value]) => value === filter)?.[1] || "قائمة الموظفين"}</h2>\n            <p className="mt-1 text-xs text-muted-foreground">قائمة مستقلة لحالة الدوام المحددة · يمكنك الرجوع للوحة الحالات من السهم.</p>\n          </div>\n        </div>\n      </section> : null}\n`;

const homeStatusBlock = `{dashboardHome ? ${finalStatusBlock} : null}\n\n`;
const detailEmployeeBlock = `{!dashboardHome ? ${employeeBlock.replaceAll('escaped={escapedIds.has(row.employeeId)}', 'escaped={escapedIds.has(row.employeeId)} permission={permissionIds.has(row.employeeId)}')} : null}`;

source = source.slice(0, statusSectionIndex) + homeStatusBlock + detailHeader + detailEmployeeBlock + source.slice(employeeEndIndex + '      </section>'.length);

const employeeRowSignature = 'const EmployeeRow = memo(function EmployeeRow({ row, escaped }: { row: DailyStatusRow; escaped: boolean }) {';
if (!source.includes(employeeRowSignature)) fail("employee row signature not found");
source = source.replace(employeeRowSignature, 'const EmployeeRow = memo(function EmployeeRow({ row, escaped, permission }: { row: DailyStatusRow; escaped: boolean; permission: boolean }) {');
const statusAnchor = '  const status = escaped ? "هارب" : statusLabel(row);';
if (!source.includes(statusAnchor)) fail("employee row status anchor not found");
source = source.replace(statusAnchor, '  const status = escaped ? "هارب" : permission ? "مستأذن" : statusLabel(row);');
const permissionFlagsAnchor = '  const leave = !escaped && row.status === "LEAVE";';
if (!source.includes(permissionFlagsAnchor)) fail("employee row leave anchor not found");
source = source.replace(permissionFlagsAnchor, `${permissionFlagsAnchor}\n  const permissionState = !escaped && permission;`);
const classAnchor = '  const cls = escaped ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";';
if (!source.includes(classAnchor)) fail("employee row class anchor not found");
source = source.replace(classAnchor, '  const cls = escaped ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : permissionState ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300" : present ? (late ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300") : rest ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : leave ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : absent ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "border-border bg-secondary/30 text-muted-foreground";');

const statusStyleAnchor = 'tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : tone === "leave" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";';
if (!source.includes(statusStyleAnchor)) fail("status shortcut style anchor not found");
source = source.replace(statusStyleAnchor, 'tone === "rest" ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300" : tone === "leave" ? "border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300" : tone === "permission" ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300" : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";');

const shortcutComponentAnchor = 'function StatusShortcut({ label, value, icon, tone, onClick, active }: { label: string; value: number; icon: ReactNode; tone: Tone; onClick: () => void; active: boolean }) {';
if (!source.includes(shortcutComponentAnchor)) fail("status shortcut component anchor not found");
const permissionIcon = `function PermissionIcon() {\n  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">\n    <path d="M19.2 9.6c0-4.5-3.1-7.6-7.1-7.6C7.8 2 4.5 4.9 4.5 9.3c0 2.5 1.2 4.1 2.4 5.6 1.1 1.3 1.9 2.4 1.9 4.1 0 1.7 1.3 3 3 3 1.6 0 2.8-.9 3.3-2.4.4-1.2.7-1.8 1.5-2.7.9-1 2.6-2.4 2.6-7.3Z"/>\n    <path d="M13.9 8.8c0-1.7-1-2.9-2.5-2.9-1.6 0-2.7 1.2-2.7 3 0 1.1.5 1.9 1.2 2.6.7.7 1.2 1.3 1.2 2.4 0 .8-.3 1.3-.9 1.7"/>\n  </svg>;\n}\n\n`;
source = source.replace(shortcutComponentAnchor, permissionIcon + shortcutComponentAnchor);

writeFileSync(file, source, "utf8");
console.log("ManagerDashboard dedicated status patch: added permission status from existing approved/confirmed requests, with a dedicated dashboard filter and professional SVG ear icon.");
