import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function filePath(path) {
  return new URL(path, root);
}

function replaceExactly(path, source, pattern, replacement, label) {
  const matches = source.match(pattern);
  const count = matches ? matches.length : 0;
  if (count !== 1) {
    throw new Error(
      `Refusing unsafe notification patch for ${path}: expected exactly one ${label}, found ${count}`,
    );
  }

  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Notification patch made no change for ${path}: ${label}`);
  }
  return next;
}

function patchManagerLayout() {
  const path = "src/components/layout/ManagerLayout.tsx";
  const file = filePath(path);
  let source = readFileSync(file, "utf8");

  if (!source.includes("syncNotificationsFromD1")) {
    source = replaceExactly(
      path,
      source,
      /  clearNotifications,\n  getNotifications,\n  markAllAsRead,\n  markAsRead as markNotificationAsRead,\n  removeNotification,\n/,
      `  clearNotifications,\n  getNotifications,\n  markAllAsRead,\n  markAsRead as markNotificationAsRead,\n  removeNotification,\n  syncNotificationsFromD1,\n`,
      "notification service imports",
    );

    source = replaceExactly(
      path,
      source,
      /const API_URL = String\([\s\S]*?\n\nasync function markServerNotificationsRead\(\) \{[\s\S]*?\n\}\n\nfunction readTheme/s,
      `async function loadServerNotifications(): Promise<AppNotification[]> {\n  await syncNotificationsFromD1();\n  return getNotifications();\n}\n\nasync function markServerNotificationRead(id: string) {\n  markNotificationAsRead(id);\n}\n\nasync function markServerNotificationsRead() {\n  markAllAsRead();\n}\n\nfunction readTheme`,
      "direct notification API helpers",
    );
  }

  if (
    source.includes('window.addEventListener("hadir:notifications-changed", refresh);')
  ) {
    source = replaceExactly(
      path,
      source,
      /      refresh\(\);\n    };\n\n    const onStorage = \(event: StorageEvent\) =>/,
      `      const all = getNotifications(currentUserId);\n      setNotifications(\n        Array.isArray(all)\n          ? all.filter(\n              (notification) =>\n                notification.userId === currentUserId ||\n                notification.userId === "manager" ||\n                notification.userId === "admin" ||\n                notification.userId === "all",\n            )\n          : [],\n      );\n    };\n\n    const onStorage = (event: StorageEvent) =>`,
      "notification-change refresh loop",
    );
  }

  writeFileSync(file, source, "utf8");
}

function patchEmployeeLayout() {
  const path = "src/components/layout/EmployeeLayout.tsx";
  const file = filePath(path);
  let source = readFileSync(file, "utf8");

  if (!source.includes("syncNotificationsFromD1")) {
    source = replaceExactly(
      path,
      source,
      /import \{ getNotifications \} from "@\/lib\/notifications";/,
      `import {\n  getNotifications,\n  syncNotificationsFromD1,\n} from "@/lib/notifications";`,
      "notification service import",
    );

    source = replaceExactly(
      path,
      source,
      /const API_URL = String\([\s\S]*?\n\nasync function loadEmployeeUnreadCount\(employeeId: string\) \{[\s\S]*?\n\}\n\nexport default function EmployeeLayout/s,
      `async function loadEmployeeUnreadCount(employeeId: string) {\n  if (!employeeId) return 0;\n\n  try {\n    await syncNotificationsFromD1();\n    return getNotifications(employeeId).filter(\n      (notification) => !notification.read,\n    ).length;\n  } catch {\n    try {\n      return getNotifications(employeeId).filter(\n        (notification) => !notification.read,\n      ).length;\n    } catch {\n      return 0;\n    }\n  }\n}\n\nexport default function EmployeeLayout`,
      "direct employee notification API helper",
    );
  }

  const oldListener =
    '    window.addEventListener("hadir:notifications-changed", () => {\n' +
    "      try {\n" +
    "        setUnreadNotifications(\n" +
    "          getNotifications(employeeId).filter(\n" +
    "            (notification) => !notification.read,\n" +
    "          ).length,\n" +
    "        );\n" +
    "      } catch {\n" +
    "        setUnreadNotifications(0);\n" +
    "      }\n" +
    "    });";
  const newListener =
    '    const onNotificationsChanged = () => {\n' +
    "      try {\n" +
    "        setUnreadNotifications(\n" +
    "          getNotifications(employeeId).filter(\n" +
    "            (notification) => !notification.read,\n" +
    "          ).length,\n" +
    "        );\n" +
    "      } catch {\n" +
    "        setUnreadNotifications(0);\n" +
    "      }\n" +
    "    };\n\n" +
    '    window.addEventListener("hadir:notifications-changed", onNotificationsChanged);';

  if (source.includes(oldListener)) {
    source = source.replace(oldListener, newListener);
  }

  if (
    source.includes('window.removeEventListener("hadir:notifications-changed", refresh);') &&
    source.includes("const onNotificationsChanged = () =>")
  ) {
    source = source.replace(
      'window.removeEventListener("hadir:notifications-changed", refresh);',
      'window.removeEventListener("hadir:notifications-changed", onNotificationsChanged);',
    );
  }

  writeFileSync(file, source, "utf8");
}

function patchManagerRequests() {
  const path = "src/pages/ManagerRequests.tsx";
  const file = filePath(path);
  let source = readFileSync(file, "utf8");

  if (!source.includes("syncNotificationsFromD1")) {
    source = replaceExactly(
      path,
      source,
      /import \{ getBackendRequests, updateBackendRequest \} from "@\/lib\/backend";\n/,
      `import { getBackendRequests, updateBackendRequest } from "@/lib/backend";\nimport {\n  getNotifications,\n  markAsRead as markNotificationAsRead,\n  syncNotificationsFromD1,\n} from "@/lib/notifications";\n`,
      "notification service imports",
    );

    source = replaceExactly(
      path,
      source,
      /async function markRelatedRequestNotificationsRead\(request: any\) \{[\s\S]*?\n\}\n\nexport default function ManagerRequests/s,
      `async function markRelatedRequestNotificationsRead(request: any) {\n  if (!request?.employeeName) return;\n\n  await syncNotificationsFromD1();\n\n  const employeeName = String(request.employeeName).trim();\n  const requestLabel = typeLabel(String(request.type || ""));\n  const matchingIds = getNotifications()\n    .filter((notification) => {\n      if (notification.read) return false;\n\n      if (!notification.body.includes(employeeName)) return false;\n\n      if (request.type === "device-rebind") {\n        return notification.title === "طلب إعادة ربط هاتف";\n      }\n\n      return (\n        notification.title === "طلب موظف جديد" &&\n        notification.body.includes(requestLabel)\n      );\n    })\n    .map((notification) => notification.id)\n    .filter(Boolean);\n\n  matchingIds.forEach((id) => markNotificationAsRead(id));\n}\n\nexport default function ManagerRequests`,
      "direct related-notification API helper",
    );
  }

  writeFileSync(file, source, "utf8");
}

patchManagerLayout();
patchEmployeeLayout();
patchManagerRequests();
console.log("Notification network centralization patch applied successfully.");
