import { existsSync, readFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const configuredBasePath = process.env.VITE_BASE_PATH || "/";
const expectedBasePath = `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "build-version.json",
];

for (const fileName of requiredFiles) {
  if (!existsSync(new URL(fileName, dist))) {
    throw new Error(`Production build validation failed: dist/${fileName} is missing.`);
  }
}

const indexHtml = readFileSync(new URL("index.html", dist), "utf8");
if (!indexHtml.includes('<div id="root"></div>')) {
  throw new Error("Production build validation failed: React root container is missing from dist/index.html.");
}

const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", dist), "utf8"));
if (manifest.id !== expectedBasePath || manifest.start_url !== expectedBasePath || manifest.scope !== expectedBasePath || manifest.display !== "standalone") {
  throw new Error("Production build validation failed: PWA manifest identity/start/scope/display is invalid.");
}

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
const iconSources = icons.map((icon) => String(icon.src || ""));
if (
  icons.length < 3 ||
  !iconSources.some((src) => src.includes("pwa-icon-192.png")) ||
  !iconSources.some((src) => src.includes("pwa-icon-512.png")) ||
  !iconSources.some((src) => src.includes("pwa-icon.svg"))
) {
  throw new Error("Production build validation failed: PNG and SVG PWA icons are missing from the manifest.");
}

const serviceWorker = readFileSync(new URL("sw.js", dist), "utf8");
for (const marker of ["BUILD_VERSION", "SKIP_WAITING", "notificationclick"]) {
  if (!serviceWorker.includes(marker)) {
    throw new Error(`Production build validation failed: service worker marker ${marker} is missing.`);
  }
}

const buildVersion = JSON.parse(readFileSync(new URL("build-version.json", dist), "utf8"));
if (!buildVersion.commitSha || buildVersion.commitSha === "unknown") {
  throw new Error("Production build validation failed: build-version.json does not contain a real commit SHA.");
}

console.log("Production build integrity verified: core assets, PWA metadata, service worker, and build identity are present.");
