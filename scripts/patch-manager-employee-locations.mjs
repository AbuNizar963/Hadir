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
          const [apiLocations, settings] = await Promise.all([
            getBackendLocations("admin").catch(() => []),
            getBackendSettings().catch(() => null),
          ]);
          const merged = new Map<string, Location>();
          for (const location of Array.isArray(apiLocations) ? apiLocations : []) merged.set(String(location.id), location);
          for (const location of Array.isArray(settings?.locations) ? settings.locations : []) merged.set(String(location.id), location);
          const nextLocations = Array.from(merged.values()).filter((location) => location && String(location.name || "").trim());
          setLocations((prev) => JSON.stringify(prev) === JSON.stringify(nextLocations) ? prev : nextLocations);
        } catch {}';
if (source.includes(oldLoad)) {
  source = source.replace(oldLoad, newLoad);
} else if (!source.includes('const [apiLocations, settings] = await Promise.all([')) {
  throw new Error("ManagerEmployees location sync anchor not found; refusing unsafe patch.");
}

writeFileSync(path, source, "utf8");
console.log("ManagerEmployees location patch: saved Settings locations are merged into the employee work-location selector.");
