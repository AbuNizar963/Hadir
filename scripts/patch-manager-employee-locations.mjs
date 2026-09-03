import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/pages/ManagerEmployees.tsx", import.meta.url);
let source = readFileSync(path, "utf8");

const oldState = 'const [locations, setLocations] = useState<Location[]>([]);';
const newState = 'const [locations, setLocations] = useState<Location[]>(() => getSettings().locations || []);';
if (source.includes(oldState)) {
  source = source.replace(oldState, newState);
}

const oldLoad = 'try { const nextLocations = await getBackendLocations("admin"); setLocations((prev) => JSON.stringify(prev) === JSON.stringify(nextLocations) ? prev : nextLocations); } catch {}';
const newLoad = `try {
          const nextLocations = await getBackendLocations("admin");
          setLocations((prev) => JSON.stringify(prev) === JSON.stringify(nextLocations) ? prev : nextLocations);
        } catch {
          const fallbackSettings = getSettings();
          const fallbackLocations = Array.isArray(fallbackSettings.locations) ? fallbackSettings.locations : [];
          setLocations((prev) => JSON.stringify(prev) === JSON.stringify(fallbackLocations) ? prev : fallbackLocations);
        }`;
if (source.includes(oldLoad)) {
  source = source.replace(oldLoad, newLoad);
} else if (!source.includes('const nextLocations = await getBackendLocations("admin");')) {
  throw new Error("ManagerEmployees location sync anchor not found; refusing unsafe patch.");
}

writeFileSync(path, source, "utf8");
console.log("ManagerEmployees location patch: authoritative API locations are loaded, with local settings used only when the API is unavailable.");
