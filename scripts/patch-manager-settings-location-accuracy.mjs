import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerSettings.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const importMarker = 'import LocationPicker from "@/components/settings/LocationPicker";';
const preciseImport = `${importMarker}\nimport { getCurrentPosition } from "@/lib/geo";`;
if (!source.includes('import { getCurrentPosition } from "@/lib/geo";')) {
  if (!source.includes(importMarker)) {
    throw new Error("ManagerSettings location accuracy patch: LocationPicker import anchor not found; refusing unsafe replacement.");
  }
  source = source.replace(importMarker, preciseImport);
}

const oldFunction = '  const getLocation = (target: "main" | "new") => { if (!navigator.geolocation) { toast.error("المتصفح لا يدعم تحديد الموقع"); return; } navigator.geolocation.getCurrentPosition(p => { if (target === "main") setS(prev => ({ ...prev, workSiteLat: p.coords.latitude, workSiteLng: p.coords.longitude })); else { setLocLat(p.coords.latitude); setLocLng(p.coords.longitude); } toast.success("تم تحديد الموقع الحالي"); }, e => toast.error("تعذر تحديد الموقع", e.code === e.PERMISSION_DENIED ? "يجب السماح للتطبيق باستخدام الموقع." : "تحقق من GPS وحاول مرة أخرى."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }); };';
const newFunction = `  const getLocation = async (target: "main" | "new") => {
    try {
      const position = await getCurrentPosition();
      if (target === "main") {
        setS(prev => ({ ...prev, workSiteLat: position.lat, workSiteLng: position.lng }));
      } else {
        setLocLat(position.lat);
        setLocLng(position.lng);
      }
      const accuracyLabel = position.accuracy === undefined ? "غير معروفة" : `${position.accuracy}م`;
      toast.success("تم تحديد الموقع بدقة", `دقة GPS المعلنة: ${accuracyLabel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحديد الموقع بدقة.";
      toast.error("تعذر تحديد الموقع بدقة", message);
    }
  };`;

if (source.includes(oldFunction)) {
  source = source.replace(oldFunction, newFunction);
} else if (!source.includes('const getLocation = async (target: "main" | "new")')) {
  throw new Error("ManagerSettings location accuracy patch: getLocation anchor not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("ManagerSettings precise GPS patch applied safely.");
