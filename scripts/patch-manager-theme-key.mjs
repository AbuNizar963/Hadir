import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const file = "src/components/layout/ManagerLayout.tsx";
const filePath = path.join(ROOT, file);
const source = fs.readFileSync(filePath, "utf8");

const declaration = 'const THEME_KEY = "hadir.theme";';
const insertionPoint = 'import {\n  getDiagnostics,\n  clearDiagnostics,\n  type DiagnosticEntry,\n} from "@/lib/systemDiagnostics";\n';

if (source.includes(declaration)) {
  console.log("ManagerLayout theme key is already defined; no change needed.");
  process.exit(0);
}

if (!source.includes("THEME_KEY")) {
  throw new Error(`Expected THEME_KEY usage was not found in ${file}.`);
}

if (!source.includes(insertionPoint)) {
  throw new Error(`Expected insertion point was not found in ${file}.`);
}

const updated = source.replace(
  insertionPoint,
  `${insertionPoint}\n${declaration}\n`,
);

if (!updated.includes(declaration)) {
  throw new Error(`Theme key declaration was not inserted into ${file}.`);
}

if (updated.split(declaration).length - 1 !== 1) {
  throw new Error(`Expected exactly one theme key declaration in ${file}.`);
}

fs.writeFileSync(filePath, updated, "utf8");
console.log("ManagerLayout theme key patch applied successfully.");
