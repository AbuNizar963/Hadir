import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const replacements = [
  {
    file: "src/pages/EmployeeHome.tsx",
    from: "يتم مزامنة الجدول والحضور من الخادم.",
    to: "تتم مزامنة الجدول والحضور من الخادم.",
  },
];

for (const replacement of replacements) {
  const filePath = path.join(ROOT, replacement.file);
  const source = fs.readFileSync(filePath, "utf8");
  const occurrences = source.split(replacement.from).length - 1;

  if (occurrences === 0) {
    if (source.includes(replacement.to)) continue;
    throw new Error(
      `Expected Arabic text was not found in ${replacement.file}: ${replacement.from}`,
    );
  }

  if (occurrences !== 1) {
    throw new Error(
      `Expected exactly one Arabic text occurrence in ${replacement.file}, found ${occurrences}.`,
    );
  }

  const updated = source.replace(replacement.from, replacement.to);
  if (!updated.includes(replacement.to) || updated.includes(replacement.from)) {
    throw new Error(`Arabic language patch validation failed for ${replacement.file}.`);
  }

  fs.writeFileSync(filePath, updated, "utf8");
}

console.log("Arabic language patches applied successfully.");
