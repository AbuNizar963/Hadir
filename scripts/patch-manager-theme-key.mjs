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

if (source.split(themeDeclaration).length - 1 !== 1) {
  throw new Error(`Expected exactly one theme key declaration in ${file}.`);
}

if (source.split(mergedNotificationImport).length - 1 !== 1) {
  throw new Error(`Expected exactly one merged notifications import in ${file}.`);
}

if (source.split(notificationDetailType).length - 1 !== 1) {
  throw new Error(`Expected exactly one notification detail type in ${file}.`);
}

fs.writeFileSync(filePath, source, "utf8");
console.log("ManagerLayout theme and notification definitions normalized successfully.");
