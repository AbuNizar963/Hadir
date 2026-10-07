import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const vitePackage = new URL("../node_modules/vite/package.json", import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) return false;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return true;
}

if (!existsSync(vitePackage)) {
  const bun = spawnSync("bun", ["--version"], { stdio: "ignore" });
  if (bun.status === 0 && !bun.error) {
    run("bun", ["install", "--frozen-lockfile"]);
  } else {
    run("npm", ["install", "--include=dev", "--no-audit", "--no-fund"]);
  }
}

// Source compatibility patches are applied to tracked source files once and
// reviewed in Git. Builds must be deterministic and must never rewrite src/.

const gitSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha.stdout?.trim() || "unknown";
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "unknown";
const deploymentUrl = process.env.CF_PAGES_URL || "";

run("npx", ["vite", "build"]);

const sourceHeaderScan = spawnSync("grep", ["-RIlE", "خدمة الدوام اليومية|settings\\.brandName", "src/pages/ManagerReports.tsx", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (sourceHeaderScan.status !== 0 || !sourceHeaderScan.stdout?.trim()) {
  throw new Error("Production build validation failed: canonical daily report branding was not found in source or dist.");
}
const shareMarkers = ["navigator.share", "html2canvas", "sharingPdf"];
const shareScan = spawnSync("grep", ["-RIlE", shareMarkers.join("|"), "src/pages/ProfessionalAttendanceReports.tsx", "src/pages/ManagerReports.tsx", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
if (shareScan.status !== 0 || !shareScan.stdout?.trim()) {
  throw new Error("Production build validation failed: direct daily PDF sharing action was not found in dist.");
}
const legacy = spawnSync("grep", ["-RIl", "رئيس القسم", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const legacyAssistant = spawnSync("grep", ["-RIl", "معاون رئيس القسم", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (legacy.status === 0 || legacyAssistant.status === 0) {
  throw new Error("Production build validation failed: legacy department owner/assistant header is still present in dist.");
}

const remoteQrScan = spawnSync("grep", ["-RIl", "api.qrserver.com", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (remoteQrScan.status === 0 && remoteQrScan.stdout?.trim()) {
  throw new Error("Production build validation failed: remote QR image dependency is still present in dist.");
}
const qrPrintScan = spawnSync("grep", ["-RIl", "hadir-qr-print-sheet", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (qrPrintScan.status !== 0 || !qrPrintScan.stdout?.trim()) {
  throw new Error("Production build validation failed: direct QR print sheet is missing from dist.");
}
console.log("Production report branding, direct PDF sharing, and local QR printing verified; legacy owner/assistant header absent.");

const faviconVersion = encodeURIComponent(commitSha);
const emittedFiles = ["index.html", "manifest.webmanifest", "sw.js"];
for (const fileName of emittedFiles) {
  const fileUrl = new URL(`../dist/${fileName}`, import.meta.url);
  if (!existsSync(fileUrl)) continue;
  const content = readFileSync(fileUrl, "utf8");
  const versioned = content
    .replaceAll("./manifest.webmanifest", `./manifest.webmanifest?v=${faviconVersion}`)
    .replaceAll("./favicon.svg", `./favicon.svg?v=${faviconVersion}`)
    .replaceAll("/favicon.svg", `/favicon.svg?v=${faviconVersion}`);
  if (versioned !== content) writeFileSync(fileUrl, versioned, "utf8");
}

const serviceWorkerUrl = new URL("../dist/sw.js", import.meta.url);
if (existsSync(serviceWorkerUrl)) {
  const serviceWorker = readFileSync(serviceWorkerUrl, "utf8");
  const versionedServiceWorker = serviceWorker.replace(
    '"__HADIR_BUILD_VERSION__"',
    JSON.stringify(commitSha),
  );
  if (versionedServiceWorker !== serviceWorker) writeFileSync(serviceWorkerUrl, versionedServiceWorker, "utf8");
}

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("../dist/build-version.json", import.meta.url), `${JSON.stringify({ commitSha, branch, deploymentUrl }, null, 2)}\n`, "utf8");
run("node", ["scripts/verify-production-build.mjs"]);
