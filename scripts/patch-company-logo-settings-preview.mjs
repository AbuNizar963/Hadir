import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/components/settings/CompanySpecialtiesPanel.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const anchor = 'const COMPANY_LOGO_API = `${String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\\/$/, "")}/api/company/logo`;';
const helper = `${anchor}\n\nfunction currentCompanyLogoUrl(value: string | null | undefined): string | null {\n  if (!value) return null;\n  try {\n    const url = new URL(value, window.location.origin);\n    if (url.pathname === "/api/company/logo") {\n      url.searchParams.set("v", String(Date.now()));\n      return url.toString();\n    }\n  } catch {\n    // Fall through to the server-provided URL.\n  }\n  return value;\n}`;
if (!source.includes("function currentCompanyLogoUrl(")) {
  if (!source.includes(anchor)) throw new Error("Company logo preview patch: API anchor not found; refusing unsafe replacement.");
  source = source.replace(anchor, helper);
}

source = source.replaceAll('setBrandLogo(local.brandLogo || null);', 'setBrandLogo(currentCompanyLogoUrl(local.brandLogo));');
source = source.replaceAll('setBrandLogo(remote.brandLogo || null);', 'setBrandLogo(currentCompanyLogoUrl(remote.brandLogo));');

if (!source.includes("setBrandLogo(currentCompanyLogoUrl(remote.brandLogo));")) {
  throw new Error("Company logo preview patch: expected settings logo assignments not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("Company logo preview patch: settings always use a fresh URL for the current /api/company/logo object, preventing stale browser image cache.");
