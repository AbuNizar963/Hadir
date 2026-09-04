import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerDashboard.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const fail = (message) => { throw new Error(`ManagerDashboard dedicated status patch: ${message}; refusing unsafe replacement.`); };

const stateAnchor = 'const [filter, setFilter] = useState<Filter>("all");';
if (!source.includes(stateAnchor)) fail("filter state anchor not found");
source = source.replace(stateAnchor, `${stateAnchor}\n  const [dashboardHome, setDashboardHome] = useState(true);`);

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

const updatedStatusBlock = statusBlock
  .replaceAll('onClick={() => setFilter("all")}', 'onClick={() => { setFilter("all"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("present")}', 'onClick={() => { setFilter("present"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("absent")}', 'onClick={() => { setFilter("absent"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("late")}', 'onClick={() => { setFilter("late"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("rest")}', 'onClick={() => { setFilter("rest"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("leave")}', 'onClick={() => { setFilter("leave"); setDashboardHome(false); }}')
  .replaceAll('onClick={() => setFilter("escaped")}', 'onClick={() => { setFilter("escaped"); setDashboardHome(false); }}');

const detailHeader = `      {!dashboardHome ? <section className="hud-card mb-5 p-4 sm:p-5">\n        <div className="flex items-center gap-3">\n          <button type="button" onClick={() => setDashboardHome(true)} aria-label="العودة إلى لوحة حالات الدوام" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-secondary text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">\n            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>\n          </button>\n          <div className="min-w-0 flex-1">\n            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-primary mono">STATUS LIST</div>\n            <h2 className="mt-1 text-xl font-black">{filters.find(([value]) => value === filter)?.[1] || "قائمة الموظفين"}</h2>\n            <p className="mt-1 text-xs text-muted-foreground">قائمة مستقلة لحالة الدوام المحددة · يمكنك الرجوع للوحة الحالات من السهم.</p>\n          </div>\n        </div>\n      </section> : null}\n`;

const homeStatusBlock = `{dashboardHome ? ${updatedStatusBlock} : null}\n\n`;
const detailEmployeeBlock = `{!dashboardHome ? ${employeeBlock} : null}`;

source = source.slice(0, statusSectionIndex) + homeStatusBlock + detailHeader + detailEmployeeBlock + source.slice(employeeEndIndex + '      </section>'.length);
writeFileSync(file, source, "utf8");
console.log("ManagerDashboard dedicated status patch: status cards now open their employee list in a dedicated view with back navigation.");
