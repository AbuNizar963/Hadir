import { getBackendEmployees, backendEnabled } from "@/lib/backend";

function deviceType(label: string): string {
  const value = label.toLowerCase();
  if (/iphone|android|pixel|samsung|redmi|xiaomi|oneplus|oppo|vivo|realme|huawei|honor|motorola|nokia|tecno|infinix/.test(value)) return "📱 هاتف";
  if (/ipad|tablet|لوحي/.test(value)) return "▣ جهاز لوحي";
  if (/windows|mac|linux|computer|pc/.test(value)) return "🖥️ حاسوب";
  return "◉ جهاز";
}

async function enhanceEmployeeDirectory() {
  if (!backendEnabled || !location.pathname.includes("/manager/employees")) return;
  const rows = await getBackendEmployees().catch(() => []);
  if (!Array.isArray(rows)) return;

  document.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const job = Array.from(card.querySelectorAll<HTMLElement>(".mono")).find((el) =>
      rows.some((employee: any) => String(employee.jobNumber) === el.textContent?.trim()),
    );
    if (!job) return;
    const employee = rows.find((item: any) => String(item.jobNumber) === job.textContent?.trim());
    if (!employee?.deviceLabel) return;
    if (card.querySelector("[data-hadir-device-details]")) return;

    const details = document.createElement("div");
    details.dataset.hadirDeviceDetails = "true";
    details.className = "mt-1 max-w-[260px] truncate text-[10px] text-primary/90";
    details.title = employee.deviceLabel;
    details.textContent = `${deviceType(employee.deviceLabel)} · ${employee.deviceLabel}`;
    job.parentElement?.appendChild(details);
  });
}

export function installDeviceDirectoryEnhancer() {
  let timer: number | undefined;
  const run = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void enhanceEmployeeDirectory(), 250);
  };
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  run();
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
