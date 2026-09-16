import { useCallback, useEffect, useMemo, useState } from "react";
import {
  XLSX,
  autoFitColumns,
  styleExcelTable,
  styleReportWorkbook,
  setExcelRtl,
  type ExcelCell,
} from "@/lib/excelExport";
import ManagerLayout from "@/components/layout/ManagerLayout";
import { getAudit } from "@/lib/storage";
import { getBackendAudit } from "@/lib/backend";
import { formatDateTime } from "@/lib/utils";
import { downloadCSV, type CsvCell } from "@/lib/csv";
import type { AuditEntry } from "@/types";
import type { ReactNode } from "react";

const ACTIONS: Record<AuditEntry["action"], string> = {
  login: "تسجيل دخول",
  "login-failed": "دخول فاشل",
  "check-in": "حضور",
  "check-out": "انصراف",
  "device-bound": "ربط جهاز",
  "device-bind": "محاولة ربط جهاز",
  "workforce-controls": "تحكم قوى العمل",
  "manager-login": "دخول مدير",
  "manager-login-failed": "دخول مدير فاشل",
  "supervisor-login": "دخول مشرف",
  "supervisor-login-failed": "دخول مشرف فاشل",
  "owner-login": "دخول مالك",
  "owner-login-failed": "دخول مالك فاشل",
  "admin-login": "دخول إداري",
  "admin-login-failed": "دخول إداري فاشل",
};

function safeAudit(value: unknown): AuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AuditEntry =>
    Boolean(entry && typeof entry === "object"),
  );
}

function actionLabel(action: AuditEntry["action"]): string {
  return ACTIONS[action] ?? String(action ?? "عملية غير معروفة");
}

function safeDate(value: unknown): string {
  try {
    return value ? formatDateTime(String(value)) : "—";
  } catch {
    return "—";
  }
}

function exportExcel(rows: AuditEntry[], scope: "filtered" | "all") {
  const headers = [
    "م",
    "الوقت",
    "الموظف",
    "الرقم الوظيفي",
    "العملية",
    "النتيجة",
    "السبب",
    "الجهاز",
    "IP",
    "خط العرض",
    "خط الطول",
    "المسافة (م)",
  ];
  const body: ExcelCell[][] = rows.map((entry, index) => [
    index + 1,
    safeDate(entry.timestamp),
    entry.actorName ?? "",
    entry.jobNumber ?? "",
    actionLabel(entry.action),
    entry.result === "success" ? "نجاح" : "رفض",
    entry.reason ?? "",
    entry.deviceId ?? "",
    entry.ip ?? "",
    entry.lat ?? "",
    entry.lng ?? "",
    entry.distanceMeters ?? "",
  ]);
  const summary: ExcelCell[][] = [
    ["ملخص سجل التدقيق", ""],
    ["عدد السجلات", rows.length],
    ["نجاح", rows.filter((entry) => entry.result === "success").length],
    ["رفض", rows.filter((entry) => entry.result !== "success").length],
    [
      "عدد الموظفين",
      new Set(
        rows.map((entry) => entry.jobNumber || entry.actorName).filter(Boolean),
      ).size,
    ],
    [
      "التصدير",
      scope === "filtered" ? "السجلات المطابقة للفلاتر" : "كل السجلات",
    ],
    ["تاريخ التصدير", new Date().toLocaleString("ar-SA")],
  ];
  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  const wsData = XLSX.utils.aoa_to_sheet([
    [`سجل التدقيق - ${new Date().toLocaleDateString("ar-SA")}`],
    [],
    headers,
    ...body,
  ]);
  wsData["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: headers.length - 1 },
    },
  ];
  wsData["!autofilter"] = {
    ref: `A3:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(
      3,
      body.length + 3,
    )}`,
  };
  styleExcelTable(wsData, 2, body.length + 2, 0, headers.length - 1, 2, 0);
  styleReportWorkbook(wsData, undefined, 3, body.length + 2);
  autoFitColumns(wsData, [headers, ...body], 10, 42);
  styleExcelTable(wsSummary, 0, summary.length - 1, 0, 1, 0);
  autoFitColumns(wsSummary, summary, 14, 42);
  setExcelRtl(wb, wsSummary);
  setExcelRtl(wb, wsData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");
  XLSX.utils.book_append_sheet(wb, wsData, "سجل التدقيق");
  XLSX.writeFile(
    wb,
    `Hadir-Audit-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export default function ManagerAudit() {
  const [data, setData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "success" | "rejected">("all");
  const [action, setAction] = useState<"all" | AuditEntry["action"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const remote = safeAudit(await getBackendAudit(2000));
      setData(remote);
    } catch (remoteError) {
      console.warn("Hadir audit log backend read deferred:", remoteError);
      const fallback = safeAudit(getAudit());
      setData(fallback);
      setError(
        fallback.length > 0
          ? "تعذر تحديث سجل التدقيق من الخادم؛ يتم عرض آخر بيانات متاحة."
          : "تعذر تحميل سجل التدقيق من الخادم.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();

    return data.filter((entry) => {
      if (filter !== "all" && entry.result !== filter) return false;
      if (action !== "all" && entry.action !== action) return false;
      if (
        search &&
        !`${entry.actorName ?? ""} ${entry.jobNumber ?? ""} ${entry.reason ?? ""}`
          .toLowerCase()
          .includes(search)
      ) {
        return false;
      }
      return true;
    });
  }, [data, q, filter, action]);

  const exportCsv = () => {
    const headers = [
      "م",
      "الوقت",
      "الموظف",
      "الرقم الوظيفي",
      "العملية",
      "النتيجة",
      "السبب",
      "الجهاز",
      "IP",
      "خط العرض",
      "خط الطول",
      "المسافة (م)",
    ];
    const body: CsvCell[][] = filtered.map((entry, index) => [
      index + 1,
      safeDate(entry.timestamp),
      entry.actorName ?? "",
      entry.jobNumber ?? "",
      actionLabel(entry.action),
      entry.result === "success" ? "نجاح" : "رفض",
      entry.reason ?? "",
      entry.deviceId ?? "",
      entry.ip ?? "",
      entry.lat ?? "",
      entry.lng ?? "",
      entry.distanceMeters ?? "",
    ]);
    downloadCSV(
      `audit-${new Date().toISOString().slice(0, 10)}`,
      headers,
      body,
    );
  };

  return (
    <ManagerLayout
      title="سجل التدقيق"
      subtitle="جميع العمليات، سواء الناجحة أو المرفوضة. غير قابل للتعديل من الموظف."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportExcel(filtered, "filtered")}
            className="btn-primary text-sm"
            disabled={loading}
          >
            تصدير Excel ذكي
          </button>
          <button
            onClick={exportCsv}
            className="btn-secondary text-sm"
            disabled={loading}
          >
            تصدير CSV
          </button>
          <button
            onClick={() => void load()}
            className="btn-secondary text-sm"
            disabled={loading}
          >
            {loading ? "جارٍ التحديث…" : "تحديث"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="hud-card mb-5 grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input md:col-span-2"
          placeholder="بحث بالاسم / الرقم / السبب..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <select
          className="input"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "all" | "success" | "rejected")
          }
        >
          <option value="all">كل النتائج</option>
          <option value="success">ناجحة فقط</option>
          <option value="rejected">مرفوضة فقط</option>
        </select>
        <select
          className="input"
          value={action}
          onChange={(event) =>
            setAction(event.target.value as "all" | AuditEntry["action"])
          }
        >
          <option value="all">كل العمليات</option>
          {Object.entries(ACTIONS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="hud-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <Th>م</Th>
                <Th>الوقت</Th>
                <Th>الموظف</Th>
                <Th>العملية</Th>
                <Th>النتيجة</Th>
                <Th>السبب</Th>
                <Th>الموقع</Th>
                <Th>الجهاز</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <Td
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    جارٍ تحميل سجل التدقيق…
                  </Td>
                </tr>
              ) : (
                filtered.map((entry, index) => {
                  const hasLocation =
                    typeof entry.lat === "number" &&
                    Number.isFinite(entry.lat) &&
                    typeof entry.lng === "number" &&
                    Number.isFinite(entry.lng);

                  return (
                    <tr
                      key={entry.id ?? `audit-${index}`}
                      className="align-top border-t border-border/50"
                    >
                      <Td className="mono font-bold">{index + 1}</Td>
                      <Td className="mono whitespace-nowrap text-xs">
                        {safeDate(entry.timestamp)}
                      </Td>
                      <Td>
                        <div className="font-semibold">
                          {entry.actorName ?? "غير معروف"}
                        </div>
                        <div className="mono text-xs text-muted-foreground">
                          {entry.jobNumber ?? "—"}
                        </div>
                      </Td>
                      <Td className="text-xs">{actionLabel(entry.action)}</Td>
                      <Td>
                        {entry.result === "success" ? (
                          <span className="badge bg-primary/15 text-primary">
                            نجاح
                          </span>
                        ) : (
                          <span className="badge bg-destructive/15 text-destructive">
                            رفض
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-[220px] text-xs">
                        {entry.reason ?? "—"}
                      </Td>
                      <Td className="mono text-[11px]">
                        {hasLocation ? (
                          <>
                            {entry.lat!.toFixed(4)}, {entry.lng!.toFixed(4)}
                            {typeof entry.distanceMeters === "number" && (
                              <div className="text-muted-foreground">
                                {entry.distanceMeters} م
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="mono max-w-[140px] break-all text-[10px] text-muted-foreground">
                        {entry.deviceId ?? "—"}
                      </Td>
                    </tr>
                  );
                })
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <Td
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    لا توجد سجلات مطابقة.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ManagerLayout>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2.5 text-right font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-3 py-2.5 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
