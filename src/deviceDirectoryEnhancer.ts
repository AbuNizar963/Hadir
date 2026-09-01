import { getBackendEmployees, backendEnabled, backendMe } from "@/lib/backend";

function deviceType(label: string): string {
  const value = label.toLowerCase();
  if (/iphone|android|pixel|samsung|redmi|xiaomi|oneplus|oppo|vivo|realme|huawei|honor|motorola|nokia|tecno|infinix/.test(value)) return "📱 هاتف";
  if (/ipad|tablet|لوحي/.test(value)) return "▣ جهاز لوحي";
  if (/windows|mac|linux|computer|pc/.test(value)) return "🖥️ حاسوب";
  return "◉ جهاز";
}

function makeBadge(text: string, tone: "primary" | "muted" = "muted") {
  const badge = document.createElement("span");
  badge.className = tone === "primary"
    ? "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
    : "inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground";
  badge.textContent = text;
  return badge;
}

async function enhanceEmployeeDirectory() {
  if (!backendEnabled || !location.pathname.includes("/manager/employees")) return;
  const rows = await getBackendEmployees().catch(() => []);
  if (!Array.isArray(rows)) return;
  const me = await backendMe().catch(() => null) as any;
  const isOwner = String(me?.user?.role || "").toLowerCase() === "owner";

  document.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const job = Array.from(card.querySelectorAll<HTMLElement>(".mono")).find((el) =>
      rows.some((employee: any) => String(employee.jobNumber) === el.textContent?.trim()),
    );
    if (!job) return;
    const employee = rows.find((item: any) => String(item.jobNumber) === job.textContent?.trim()) as any;
    if (!employee) return;

    // Replace the old generic trusted-device marker with a compact, useful device identity.
    card.querySelectorAll<HTMLElement>("[data-hadir-trusted-device]").forEach((el) => el.remove());
    const oldTrusted = Array.from(card.querySelectorAll<HTMLElement>("*"))
      .find((el) => el.textContent?.trim() === "جهاز موثق");
    if (oldTrusted && oldTrusted !== card) oldTrusted.remove();

    if (!card.querySelector("[data-hadir-device-details]")) {
      const details = document.createElement("div");
      details.dataset.hadirDeviceDetails = "true";
      details.className = "mt-1 flex max-w-full items-center gap-1 text-[10px] text-primary/90";
      const label = String(employee.deviceLabel || "غير مرتبط").trim();
      details.title = label;
      details.textContent = `${deviceType(label)} · ${label}`;
      job.parentElement?.appendChild(details);
    }

    // VIP and automation status are visible in the management card; changing them remains owner-only.
    const titleHost = job.parentElement;
    if (titleHost && !titleHost.querySelector("[data-hadir-employee-flags]")) {
      const flags = document.createElement("div");
      flags.dataset.hadirEmployeeFlags = "true";
      flags.className = "mt-2 flex flex-wrap items-center gap-1.5";
      if (employee.isVip) flags.appendChild(makeBadge("⭐ VIP", "primary"));
      if (employee.autoCheckIn) flags.appendChild(makeBadge("تحضير تلقائي", "primary"));
      if (employee.autoCheckOut) flags.appendChild(makeBadge("انصراف تلقائي", "primary"));
      if (!flags.childElementCount) flags.appendChild(makeBadge("موظف عادي"));
      titleHost.appendChild(flags);
    }

    // Make sensitive controls visually owner-only without altering existing manager actions.
    card.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const text = button.textContent?.trim() || "";
      if (/تحضير|انصراف|تلقائي|VIP/.test(text)) {
        if (!isOwner) {
          button.disabled = true;
          button.title = "هذه الميزة متاحة للمالك فقط";
          button.setAttribute("aria-disabled", "true");
          button.classList.add("opacity-50", "cursor-not-allowed");
        }
      }
    });
  });
}

function enhanceEmployeeHome() {
  if (!location.pathname.startsWith("/employee")) return;
  document.querySelectorAll<HTMLElement>("div").forEach((row) => {
    if (row.dataset.hadirDeviceDetails || row.textContent?.trim() !== "الجهاز") return;
    const value = row.parentElement?.querySelector<HTMLElement>("div.font-semibold");
    if (!value || value.dataset.hadirDeviceDetails) return;
    const label = value.textContent?.trim();
    if (!label || label === "غير مرتبط") return;
    value.dataset.hadirDeviceDetails = "true";
    value.textContent = `${deviceType(label)} · ${label}`;
    value.title = label;
  });
}

async function enhance() {
  await enhanceEmployeeDirectory();
  enhanceEmployeeHome();
}

export function installDeviceDirectoryEnhancer() {
  let timer: number | undefined;
  let running = false;
  const run = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      if (running) return;
      running = true;
      try { await enhance(); } finally { running = false; }
    }, 250);
  };
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  run();
  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
