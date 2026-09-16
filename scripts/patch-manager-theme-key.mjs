import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const file = "src/components/layout/ManagerLayout.tsx";
const filePath = path.join(ROOT, file);
let source = fs.readFileSync(filePath, "utf8");

const themeDeclaration = 'const THEME_KEY = "hadir.theme";';
const themeInsertionPoint = 'import {\n  getDiagnostics,\n  clearDiagnostics,\n  type DiagnosticEntry,\n} from "@/lib/systemDiagnostics";\n';
const notificationTypeImport = 'import type { AppNotification } from "@/lib/notifications";';
const notificationImport = 'import {\n  NOTIFICATIONS_CHANGED_EVENT,\n  type AppNotification,\n} from "@/lib/notifications";';
const notificationServiceImport = 'import {\n  clearNotifications,\n  getNotifications,\n  markAllAsRead,\n  markAsRead as markNotificationAsRead,\n  removeNotification,\n  syncNotificationsFromD1,\n} from "@/lib/notifications";';
const mergedNotificationImport = 'import {\n  NOTIFICATIONS_CHANGED_EVENT,\n  clearNotifications,\n  getNotifications,\n  markAllAsRead,\n  markAsRead as markNotificationAsRead,\n  removeNotification,\n  syncNotificationsFromD1,\n  type AppNotification,\n} from "@/lib/notifications";';
const notificationDetailType = `type NotificationsChangedDetail = {\n  notificationIds?: string[];\n};`;
const navigationType = `type ManagerNavItem = {\n  to: string;\n  label: string;\n  icon: typeof LayoutDashboard;\n  end?: boolean;\n  editRoles?: string[];\n};`;
const navigationDefinition = `const NAV: ManagerNavItem[] = [\n  {\n    to: "/manager",\n    label: "لوحة التحكم",\n    icon: LayoutDashboard,\n    end: true,\n    editRoles: ["owner", "manager", "supervisor"],\n  },\n  {\n    to: "/manager/employees",\n    label: "الموظفون",\n    icon: Users,\n    editRoles: ["owner", "manager", "supervisor"],\n  },\n  {\n    to: "/manager/workforce",\n    label: "قوى العمل",\n    icon: ClipboardCheck,\n    editRoles: ["owner", "manager", "supervisor"],\n  },\n  {\n    to: "/manager/requests",\n    label: "الطلبات",\n    icon: ClipboardList,\n    editRoles: ["owner", "manager"],\n  },\n  {\n    to: "/manager/audit",\n    label: "التدقيق",\n    icon: Wrench,\n    editRoles: ["owner", "manager", "supervisor"],\n  },\n  {\n    to: "/manager/reports",\n    label: "التقارير",\n    icon: BarChart3,\n    editRoles: ["owner", "manager"],\n  },\n  {\n    to: "/manager/report-archive",\n    label: "أرشيف التقارير",\n    icon: Archive,\n    editRoles: ["owner", "manager"],\n  },\n  {\n    to: "/manager/settings",\n    label: "الإعدادات",\n    icon: Settings,\n    editRoles: ["owner"],\n  },\n];`;

if (!source.includes(themeDeclaration)) {
  if (!source.includes("THEME_KEY")) {
    throw new Error(`Expected THEME_KEY usage was not found in ${file}.`);
  }

  if (!source.includes(themeInsertionPoint)) {
    throw new Error(`Expected theme insertion point was not found in ${file}.`);
  }

  source = source.replace(
    themeInsertionPoint,
    `${themeInsertionPoint}\n${themeDeclaration}\n`,
  );
}

if (!source.includes("NOTIFICATIONS_CHANGED_EVENT")) {
  throw new Error(
    `Expected NOTIFICATIONS_CHANGED_EVENT usage was not found in ${file}.`,
  );
}

if (source.includes(notificationServiceImport)) {
  if (source.includes(notificationTypeImport)) {
    source = source.replace(
      `${notificationServiceImport}\n${notificationTypeImport}`,
      mergedNotificationImport,
    );
  } else if (source.includes(notificationImport)) {
    source = source.replace(
      `${notificationServiceImport}\n${notificationImport}`,
      mergedNotificationImport,
    );
  } else {
    source = source.replace(notificationServiceImport, mergedNotificationImport);
  }
} else if (source.includes(notificationTypeImport)) {
  source = source.replace(notificationTypeImport, notificationImport);
} else if (!source.includes(mergedNotificationImport)) {
  throw new Error(`Expected notifications import was not found in ${file}.`);
}

if (!source.includes(notificationDetailType)) {
  if (!source.includes(themeDeclaration)) {
    throw new Error(`Theme declaration is missing from ${file}.`);
  }

  source = source.replace(
    `${themeDeclaration}\n`,
    `${themeDeclaration}\n\n${notificationDetailType}\n`,
  );
}

if (!source.includes(navigationDefinition)) {
  if (source.includes("const NAV:")) {
    throw new Error(`An unexpected NAV definition already exists in ${file}.`);
  }

  if (!source.includes("const filteredNav = NAV.filter(")) {
    throw new Error(`Expected NAV usage was not found in ${file}.`);
  }

  if (!source.includes(notificationDetailType)) {
    throw new Error(`Notification detail type is missing from ${file}.`);
  }

  source = source.replace(
    `${notificationDetailType}\n`,
    `${notificationDetailType}\n\n${navigationType}\n\n${navigationDefinition}\n`,
  );
}

if (source.split(themeDeclaration).length - 1 !== 1) {
  throw new Error(`Expected exactly one theme key declaration in ${file}.`);
}

if (source.split(mergedNotificationImport).length - 1 !== 1) {
  throw new Error(`Expected exactly one merged notifications import in ${file}.`);
}

if (source.split(notificationDetailType).length - 1 !== 1) {
  throw new Error(`Expected exactly one notification detail type in ${file}.`);
}

if (source.split(navigationType).length - 1 !== 1) {
  throw new Error(`Expected exactly one manager navigation type in ${file}.`);
}

if (source.split(navigationDefinition).length - 1 !== 1) {
  throw new Error(`Expected exactly one manager navigation definition in ${file}.`);
}

fs.writeFileSync(filePath, source, "utf8");
console.log("ManagerLayout theme, notification, and navigation definitions normalized successfully.");
