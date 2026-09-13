from pathlib import Path
import re


SOURCE = Path("src/pages/ManagerReports.tsx")
CSS = Path("public/report-print.css")


def restore_source() -> None:
    source = SOURCE.read_text(encoding="utf-8")

    backend_import = re.compile(
        r'import\s*\{([\s\S]*?)\}\s*from\s*["\']@/lib/backend["\'];'
    )
    match = backend_import.search(source)
    if not match:
        raise RuntimeError("ManagerReports: backend import declaration not found")
    names = [item.strip() for item in match.group(1).split(",") if item.strip()]
    if "getBackendSettings" not in names:
        names.append("getBackendSettings")
        replacement = "import {\n" + "".join(f"  {name},\n" for name in names) + '} from "@/lib/backend";'
        source = source[: match.start()] + replacement + source[match.end() :]

    if "const [reportSettings, setReportSettings]" not in source:
        anchor = "  const settings = getSettings();"
        if anchor not in source:
            raise RuntimeError("ManagerReports: settings anchor not found")
        replacement = '''  const [reportSettings, setReportSettings] = useState(() => getSettings());
  const settings = reportSettings;
  useEffect(() => {
    let alive = true;
    const loadReportSettings = async () => {
      try {
        const remote = await getBackendSettings();
        if (!alive || !remote) return;
        setReportSettings((current) => ({
          ...current,
          ...remote,
          adminAccounts: Array.isArray(remote.adminAccounts)
            ? remote.adminAccounts
            : current.adminAccounts,
        }));
      } catch (error) {
        console.warn("تعذر تحميل إعدادات التقرير من D1:", error);
      }
    };
    void loadReportSettings();
    const onSettingsChanged = () => {
      setReportSettings(getSettings());
      void loadReportSettings();
    };
    window.addEventListener("hadir:cloud-data-changed", onSettingsChanged);
    window.addEventListener("hadir:d1-view-changed", onSettingsChanged);
    return () => {
      alive = false;
      window.removeEventListener("hadir:cloud-data-changed", onSettingsChanged);
      window.removeEventListener("hadir:d1-view-changed", onSettingsChanged);
    };
  }, []);'''
        source = source.replace(anchor, replacement, 1)

    if 'className="daily-print-report"' not in source:
        daily_call = '''serviceRows(
            summaries,
            dates,
            index,
            settings,
            requests,
            dailyStatusMap,
          )'''
        daily_filtered_call = '''serviceRows(
            summaries.filter((s) =>
              getEmployeeWorkPeriod(s.employee, dateOf(date)).isWorkDay,
            ),
            dates,
            index,
            settings,
            requests,
            dailyStatusMap,
          )'''
        if daily_call not in source:
            raise RuntimeError("ManagerReports: daily service rows call not found")
        source = source.replace(daily_call, daily_filtered_call, 1)

        section_pattern = re.compile(
            r'      <section\n        className="service-report[^\n]*"\n        dir="rtl"\n      >'
        )
        section = section_pattern.search(source)
        if not section:
            raise RuntimeError("ManagerReports: service report section not found")
        source = source[: section.end()] + '\n          <div className="print:hidden">' + source[section.end() :]

        closing = '        </section>\n      ) : (\n'
        if closing not in source:
            raise RuntimeError("ManagerReports: service report closing anchor not found")

        print_block = '''          <div className="daily-print-report" dir="rtl">
            <header className="daily-print-header">
              {settings.brandLogo && (
                <img
                  src={settings.brandLogo}
                  alt="شعار الشركة"
                  className="daily-print-logo"
                />
              )}
              <div className="daily-print-company">
                {settings.brandName || "HADIR"}
              </div>
              <div className="daily-print-title">
                سجل الحضور والانصراف ليوم {days[dateOf(date).getDay()]} {String(
                  dateOf(date).getDate(),
                ).padStart(2, "0")}/{String(
                  dateOf(date).getMonth() + 1,
                ).padStart(2, "0")}/{dateOf(date).getFullYear()}
              </div>
            </header>
            <table className="daily-print-table">
              <colgroup>
                <col className="daily-print-no" />
                <col className="daily-print-specialty" />
                <col className="daily-print-name" />
                <col className="daily-print-status" />
                <col className="daily-print-time" />
                <col className="daily-print-time" />
                <col className="daily-print-note" />
              </colgroup>
              <thead>
                <tr>
                  <th>ت</th>
                  <th>الاختصاص</th>
                  <th>اسم الموظف</th>
                  <th>الحالة</th>
                  <th>الحضور</th>
                  <th>الانصراف</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {dailyServiceRows.map((row, i) => (
                  <tr key={row.employee.id}>
                    <td className="daily-print-center">{i + 1}</td>
                    <td>{specialtyOf(row.employee)}</td>
                    <td className="daily-print-name-cell">{row.employee.name}</td>
                    <td className="daily-print-center">
                      <span className={`daily-print-status ${row.status}`}>
                        {labels[row.status]}
                      </span>
                    </td>
                    <td className="daily-print-center">{row.checkIn}</td>
                    <td className="daily-print-center">{row.checkOut}</td>
                    <td>{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
'''
        source = source.replace(
            closing,
            '          </div>\n' + print_block + closing,
            1,
        )

    SOURCE.write_text(source, encoding="utf-8")


def restore_css() -> None:
    css = CSS.read_text(encoding="utf-8")
    if ".daily-print-report {" in css:
        return
    block = '''  .daily-print-report {
    display: none !important;
    direction: rtl !important;
    width: 100% !important;
    font-family: Cairo, Arial, sans-serif !important;
    color: #111827 !important;
    background: #fff !important;
  }

  .daily-print-header {
    display: block !important;
    text-align: center !important;
    margin: 0 0 7mm !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .daily-print-logo {
    display: block !important;
    width: 31mm !important;
    height: 31mm !important;
    object-fit: contain !important;
    margin: 0 auto 2mm !important;
  }

  .daily-print-company {
    font-size: 20px !important;
    line-height: 1.35 !important;
    font-weight: 900 !important;
    margin-bottom: 1.5mm !important;
  }

  .daily-print-title {
    font-size: 15px !important;
    line-height: 1.4 !important;
    font-weight: 800 !important;
  }

  .daily-print-table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    direction: rtl !important;
    font-size: 10.5pt !important;
    border: 0.45mm solid #111827 !important;
  }

  .daily-print-table th,
  .daily-print-table td {
    border: 0.25mm solid #475569 !important;
    padding: 1.6mm 1.4mm !important;
    line-height: 1.3 !important;
    text-align: center !important;
    vertical-align: middle !important;
    overflow-wrap: anywhere !important;
    word-break: normal !important;
  }

  .daily-print-table th {
    font-weight: 900 !important;
    background: #e2e8f0 !important;
    color: #0f172a !important;
  }

  .daily-print-table tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .daily-print-no {
    width: 9mm !important;
  }

  .daily-print-specialty {
    width: 29mm !important;
  }

  .daily-print-name {
    width: 42mm !important;
  }

  .daily-print-status {
    width: 24mm !important;
  }

  .daily-print-time {
    width: 24mm !important;
  }

  .daily-print-note {
    width: auto !important;
  }

  .daily-print-name-cell {
    font-weight: 800 !important;
  }

  .daily-print-center {
    text-align: center !important;
    white-space: nowrap !important;
  }

  .daily-print-status {
    display: inline-block !important;
    font-weight: 800 !important;
    white-space: nowrap !important;
  }

  .service-report > .daily-print-report {
    display: block !important;
  }
'''
    CSS.write_text(css.replace("  .service-report {", block + "\n  .service-report {", 1), encoding="utf-8")


restore_source()
restore_css()
print("Daily print report restored in canonical source.")
