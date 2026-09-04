import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");
const marker = 'const [activeTab, setActiveTab] = useState<SettingsTab>("general");';
if (!source.includes('  ' + marker)) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error("ManagerSettings locations anchor normalization failed: activeTab marker not found.");
  source = source.slice(0, index) + '  ' + source.slice(index);
  writeFileSync(file, source, "utf8");
}
console.log("ManagerSettings locations anchor normalized safely.");
