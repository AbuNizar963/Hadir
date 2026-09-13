import fs from "node:fs";

function replaceOnce(path, pattern, replacement, label) {
  const source = fs.readFileSync(path, "utf8");
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`${label} anchor not found`);
  fs.writeFileSync(path, next);
}

replaceOnce(
  "src/components/NotificationBell.tsx",
  /\n    const deletedResponse = await fetch\([\s\S]*?\n    const deleted = new Set\([\s\S]*?\n    return Array\.isArray\(rows\)\n      \? rows\n([\s\S]*?)\.filter\(\(notification\) => !deleted\.has\(notification\.id\)\)\n      : \[\];/,
  "\n    return Array.isArray(rows)\n      ? rows$1\n      : [];",
  "notification polling deleted-state round trip",
);

replaceOnce(
  "backend/src/app.ts",
  /async function ensureWorkflowSchema\(db: D1Database\) \{[\s\S]*?\n\}\n/,
  "",
  "app runtime schema function",
);
replaceOnce(
  "backend/src/app.ts",
  /    await ensureWorkflowSchema\(env\.DB\);\n/,
  "",
  "app runtime schema call",
);

replaceOnce(
  "backend/src/workforce.ts",
  /async function ensureWorkforceSchema\(db: D1Database\) \{[\s\S]*?\n\}\n/,
  "",
  "workforce runtime schema function",
);
replaceOnce(
  "backend/src/workforce.ts",
  /  await ensureWorkforceSchema\(env\.DB\);\n/,
  "",
  "workforce runtime schema call",
);
