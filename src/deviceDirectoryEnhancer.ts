import {
  backendEnabled,
  backendMe,
  getBackendEmployees,
} from "@/lib/backend";

const EMPLOYEE_DATA_TTL_MS = 30_000;

type EmployeeDirectoryRow = Awaited<ReturnType<typeof getBackendEmployees>>[number];

let cachedRows: EmployeeDirectoryRow[] | null = null;
let cachedRowsAt = 0;
let rowsPromise: Promise<EmployeeDirectoryRow[]> | null = null;
let cachedOwner: boolean | null = null;
let ownerPromise: Promise<boolean> | null = null;
let lastPathname = "";

function deviceType(label: string): string {
  const value = label.toLowerCase();

  if (/iphone|android|pixel|samsung|redmi|xiaomi|oneplus|oppo|vivo|realme|huawei|honor|motorola|nokia|tecno|infinix/.test(value)) {
    return "📱 هاتف";
  }

  if (/ipad|tablet|لوحي/.test(value)) {
    return "▣ جهاز لوحي";
  }

  if (/windows|mac|linux|computer|pc/.test(value)) {
    return "🖥️ حاسوب";
  }

  return "◉ جهاز";
}

function makeBadge(
  text: string,
  tone: "primary" | "muted" = "muted",
): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = tone === "primary"
    ? "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
    : "inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground";
  badge.textContent = text;
  return badge;
}

async function getDirectoryRows(): Promise<EmployeeDirectoryRow[]> {
  const now = Date.now();

  if (cachedRows && now - cachedRowsAt < EMPLOYEE_DATA_TTL_MS) {
    return cachedRows;
  }

  if (rowsPromise) {
    return rowsPromise;
  }

  rowsPromise = getBackendEmployees()
    .then((rows) => {
      cachedRows = Array.isArray(rows) ? rows : [];
      cachedRowsAt = Date.now();
      return cachedRows;
    })
    .finally(() => {
      rowsPromise = null;
    });

  return rowsPromise;
}

async function isOwner(): Promise<boolean> {
  if (cachedOwner !== null) {
    return cachedOwner;
  }

  if (ownerPromise) {
    return ownerPromise;
  }

  ownerPromise = backendMe()
    .then((me) => String(me?.user?.role || "").toLowerCase() === "owner")
    .catch(() => false)
    .then((value) => {
      cachedOwner = value;
      return value;
    })
    .finally(() => {
      ownerPromise = null;
    });

  return ownerPromise;
}

function findEmployeeForCard(
  card: HTMLElement,
  rows: EmployeeDirectoryRow[],
): EmployeeDirectoryRow | undefined {
  const job = Array.from(card.querySelectorAll<HTMLElement>(".mono")).find((element) => {
    const value = element.textContent?.trim();
    return Boolean(value && rows.some((employee) => String(employee.jobNumber) === value));
  });

  if (!job) {
    return undefined;
  }

  const jobNumber = job.textContent?.trim();
  return rows.find((employee) => String(employee.jobNumber) === jobNumber);
}

function enhanceEmployeeCard(
  card: HTMLElement,
  employee: EmployeeDirectoryRow,
  owner: boolean,
): void {
  const job = Array.from(card.querySelectorAll<HTMLElement>(".mono")).find(
    (element) => String(element.textContent?.trim() || "") === String(employee.jobNumber),
  );

  if (!job) {
    return;
  }

  card.querySelectorAll<HTMLElement>("[data-hadir-trusted-device]").forEach((element) => {
    element.remove();
  });

  const oldTrusted = Array.from(card.querySelectorAll<HTMLElement>("*"))
    .find((element) => element.textContent?.trim() === "جهاز موثق");

  if (oldTrusted && oldTrusted !== card) {
    oldTrusted.remove();
  }

  if (!card.querySelector("[data-hadir-device-details]")) {
    const details = document.createElement("div");
    details.dataset.hadirDeviceDetails = "true";
    details.className = "mt-1 flex max-w-full items-center gap-1 text-[10px] text-primary/90";

    const label = String(employee.deviceLabel || "غير مرتبط").trim();
    details.title = label;
    details.textContent = `${deviceType(label)} · ${label}`;
    job.parentElement?.appendChild(details);
  }

  const titleHost = job.parentElement;

  if (titleHost && !titleHost.querySelector("[data-hadir-employee-flags]")) {
    const flags = document.createElement("div");
    flags.dataset.hadirEmployeeFlags = "true";
    flags.className = "mt-2 flex flex-wrap items-center gap-1.5";

    if (employee.isVip) {
      flags.appendChild(makeBadge("⭐ VIP", "primary"));
    }

    if (employee.autoCheckIn) {
      flags.appendChild(makeBadge("تحضير تلقائي", "primary"));
    }

    if (employee.autoCheckOut) {
      flags.appendChild(makeBadge("انصراف تلقائي", "primary"));
    }

    if (!flags.childElementCount) {
      flags.appendChild(makeBadge("موظف عادي"));
    }

    titleHost.appendChild(flags);
  }

  card.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = button.textContent?.trim() || "";

    if (!/تحضير|انصراف|تلقائي|VIP/.test(text)) {
      return;
    }

    if (!owner) {
      button.disabled = true;
      button.title = "هذه الميزة متاحة للمالك فقط";
      button.setAttribute("aria-disabled", "true");
      button.classList.add("opacity-50", "cursor-not-allowed");
    }
  });
}

function enhanceEmployeeHome(): void {
  if (!location.pathname.startsWith("/employee")) {
    return;
  }

  document.querySelectorAll<HTMLElement>("div").forEach((row) => {
    if (row.dataset.hadirDeviceDetails || row.textContent?.trim() !== "الجهاز") {
      return;
    }

    const value = row.parentElement?.querySelector<HTMLElement>("div.font-semibold");

    if (!value || value.dataset.hadirDeviceDetails) {
      return;
    }

    const label = value.textContent?.trim();

    if (!label || label === "غير مرتبط") {
      return;
    }

    value.dataset.hadirDeviceDetails = "true";
    value.textContent = `${deviceType(label)} · ${label}`;
    value.title = label;
  });
}

async function enhanceEmployeeDirectory(): Promise<void> {
  if (!backendEnabled || !location.pathname.includes("/manager/employees")) {
    return;
  }

  const [rows, owner] = await Promise.all([
    getDirectoryRows().catch(() => [] as EmployeeDirectoryRow[]),
    isOwner(),
  ]);

  if (!rows.length) {
    return;
  }

  document.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const employee = findEmployeeForCard(card, rows);

    if (employee) {
      enhanceEmployeeCard(card, employee, owner);
    }
  });
}

async function enhance(): Promise<void> {
  const pathname = location.pathname;

  if (pathname !== lastPathname) {
    lastPathname = pathname;
    if (pathname.includes("/manager/employees")) {
      cachedRows = null;
      cachedRowsAt = 0;
    }
  }

  await enhanceEmployeeDirectory();
  enhanceEmployeeHome();
}

export function installDeviceDirectoryEnhancer(): () => void {
  let timer: number | undefined;
  let running = false;
  let disposed = false;

  const run = () => {
    window.clearTimeout(timer);

    timer = window.setTimeout(async () => {
      if (disposed || running) {
        return;
      }

      running = true;

      try {
        await enhance();
      } finally {
        running = false;
      }
    }, 400);
  };

  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  run();

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    observer.disconnect();
  };
}
