import { readFileSync, writeFileSync } from "node:fs";

const targets = [
  {
    path: new URL("../src/components/layout/ManagerLayout.tsx", import.meta.url),
    stateAnchor: '  const [themeMenuOpen, setThemeMenuOpen] = useState(false);',
    effect: `  useEffect(() => {\n    let lastScrollY = window.scrollY;\n    const onScroll = () => {\n      const currentScrollY = window.scrollY;\n      if (menuOpen && currentScrollY > lastScrollY + 2) {\n        setMenuOpen(false);\n        setThemeMenuOpen(false);\n      }\n      lastScrollY = currentScrollY;\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => window.removeEventListener("scroll", onScroll);\n  }, [menuOpen]);\n`,
  },
  {
    path: new URL("../src/components/layout/EmployeeLayout.tsx", import.meta.url),
    stateAnchor: '  const [themeMenuOpen, setThemeMenuOpen] = useState(false);',
    effect: `  useEffect(() => {\n    let lastScrollY = window.scrollY;\n    const onScroll = () => {\n      const currentScrollY = window.scrollY;\n      if (menuOpen && currentScrollY > lastScrollY + 2) {\n        setMenuOpen(false);\n        setThemeMenuOpen(false);\n      }\n      lastScrollY = currentScrollY;\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => window.removeEventListener("scroll", onScroll);\n  }, [menuOpen]);\n`,
  },
];

for (const target of targets) {
  let source = readFileSync(target.path, "utf8");
  if (source.includes("lastScrollY = window.scrollY")) {
    console.log(`menu auto-close already present: ${target.path.pathname}`);
    continue;
  }
  if (!source.includes(target.stateAnchor)) {
    throw new Error(`Menu auto-close patch anchor not found in ${target.path.pathname}; refusing unsafe replacement.`);
  }
  source = source.replace(target.stateAnchor, `${target.stateAnchor}\n${target.effect}`);
  writeFileSync(target.path, source, "utf8");
  console.log(`menu auto-close added: ${target.path.pathname}`);
}

// The Telegram/settings UI patch runs before this script. Patch its generated
// ManagerSettings code here so a later D1 read can never resurrect a stale logo.
const settingsFile = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let settingsSource = readFileSync(settingsFile, "utf8");

const oldLoad = `const merged = { ...getSettings(), ...cloud, adminAccounts: Array.isArray(cloud.adminAccounts) ? cloud.adminAccounts : getSettings().adminAccounts } as Settings; saveSettings(merged); setS(merged); setLocLat(merged.workSiteLat); setLocLng(merged.workSiteLng); setLocRadius(merged.radiusMeters);`;
const newLoad = `const merged = { ...getSettings(), ...cloud, adminAccounts: Array.isArray(cloud.adminAccounts) ? cloud.adminAccounts : getSettings().adminAccounts } as Settings;\n        // The current company logo is served directly from R2. Never let a stale\n        // D1 brandLogo value win after a full page reload.\n        try {\n          const logoApi = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\\/$/, "") + "/api/company/logo?v=" + Date.now();\n          const logoResponse = await fetch(logoApi, { method: "GET", cache: "no-store", credentials: "include" });\n          merged.brandLogo = logoResponse.ok ? logoApi : null;\n        } catch {\n          merged.brandLogo = null;\n        }\n        saveSettings(merged); setS(merged); setLocLat(merged.workSiteLat); setLocLng(merged.workSiteLng); setLocRadius(merged.radiusMeters);`;
if (settingsSource.includes(oldLoad)) {
  settingsSource = settingsSource.replace(oldLoad, newLoad);
} else if (!settingsSource.includes("The current company logo is served directly from R2")) {
  throw new Error("Settings logo reload patch: initial settings load anchor not found; refusing unsafe replacement.");
}

const oldDelete = `const remote = await getBackendSettings(); const merged = { ...getSettings(), ...remote } as Settings; saveSettings(merged); setS(merged); window.dispatchEvent(new Event("hadir:settings-changed")); toast.success("تمت إزالة شعار الشركة");`;
const newDelete = `const immediate = { ...getSettings(), brandLogo: null } as Settings;\n      saveSettings(immediate);\n      setS(immediate);\n      window.dispatchEvent(new Event("hadir:settings-changed"));\n      toast.success("تمت إزالة شعار الشركة نهائيًا");`;
if (settingsSource.includes(oldDelete)) {
  settingsSource = settingsSource.replace(oldDelete, newDelete);
} else if (!settingsSource.includes("تمت إزالة شعار الشركة نهائيًا")) {
  throw new Error("Settings logo removal patch: delete refresh anchor not found; refusing unsafe replacement.");
}

writeFileSync(settingsFile, settingsSource, "utf8");
console.log("ManagerSettings logo persistence patch: reload reads the current logo directly from R2 and successful removal clears the UI without rehydrating stale D1 logo state.");
