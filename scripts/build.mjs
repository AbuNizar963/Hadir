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

run("node", ["scripts/repair-manager-report-patch.mjs"]);
run("node", ["scripts/patch-manager-reports-final.mjs"]);
run("node", ["scripts/patch-manager-reports-final2.mjs"]);
run("node", ["scripts/patch-manager-reports-live.mjs"]);
run("node", ["scripts/patch-manager-report-header.mjs"]);
run("node", ["scripts/patch-manager-report-share.mjs"]);
run("node", ["scripts/patch-manager-report-filename.mjs"]);
run("node", ["scripts/patch-manager-reports-historical-v2.mjs"]);
run("node", ["scripts/patch-manager-reports-damascus-date.mjs"]);
run("node", ["scripts/patch-manager-settings-ui.mjs"]);
run("node", ["scripts/fix-manager-settings-ui-qr.mjs"]);
run("node", ["scripts/patch-manager-settings-telegram-ui.mjs"]);
run("node", ["scripts/normalize-manager-settings-locations-anchor.mjs"]);
run("node", ["scripts/patch-manager-settings-locations-dedicated.mjs"]);
run("node", ["scripts/patch-manager-settings-locations-fixes.mjs"]);
// Work-site settings: canonical main site + restored QR visual treatment + add-site action placement.
run("node", ["scripts/patch-manager-settings-reset-placement.mjs"]);
run("node", ["scripts/patch-manager-dashboard-dedicated-status.mjs"]);
run("node", ["scripts/patch-manager-menu-autoclose-on-scroll.mjs"]);
run("node", ["scripts/patch-manager-employee-locations.mjs"]);
run("node", ["scripts/patch-employee-home-shift-info.mjs"]);

const gitSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha.stdout?.trim() || "unknown";
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "unknown";
const deploymentUrl = process.env.CF_PAGES_URL || "";

const bun = spawnSync("bun", ["--version"], { stdio: "ignore" });
if (bun.status === 0 && !bun.error) {
  if (!run("bun", ["run", "vite", "build"])) {
    run("npm", ["run", "build"]);
  }
} else {
  run("npm", ["run", "build"]);
}

// Production invariants: the generated report bundle must contain the branded
// daily report and the direct PDF-share implementation. Validate stable code
// markers because localized UI text may be minified/encoded by Vite/Rollup.
const scan = spawnSync("grep", ["-RIl", "سجل الحضور والغياب ليوم", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (scan.status !== 0 || !scan.stdout?.trim()) {
  throw new Error("Production build validation failed: branded daily report header was not found in dist.");
}
const shareMarkers = ["navigator.share", "html2canvas", "sharingPdf"];
const shareScan = spawnSync("grep", ["-RIlE", shareMarkers.join("|"), "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (shareScan.status !== 0 || !shareScan.stdout?.trim()) {
  throw new Error("Production build validation failed: direct daily PDF sharing action was not found in dist.");
}
const legacy = spawnSync("grep", ["-RIl", "رئيس القسم", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const legacyAssistant = spawnSync("grep", ["-RIl", "معاون رئيس القسم", "dist"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (legacy.status === 0 || legacyAssistant.status === 0) {
  throw new Error("Production build validation failed: legacy department owner/assistant header is still present in dist.");
}
console.log("Production report header and direct PDF sharing verified; legacy owner/assistant header absent.");

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
  if (versioned !== content) {
    writeFileSync(fileUrl, versioned, "utf8");
  }
}

const serviceWorkerUrl = new URL("../dist/sw.js", import.meta.url);
if (existsSync(serviceWorkerUrl)) {
  const serviceWorker = readFileSync(serviceWorkerUrl, "utf8");
  const versionedServiceWorker = serviceWorker.replace(
    '"__HADIR_BUILD_VERSION__"',
    JSON.stringify(commitSha),
  );
  if (versionedServiceWorker !== serviceWorker) {
    writeFileSync(serviceWorkerUrl, versionedServiceWorker, "utf8");
  }
}

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/build-version.json", import.meta.url),
  `${JSON.stringify({ commitSha, branch, deploymentUrl }, null, 2)}\n`,
  "utf8",
);

run("node", ["scripts/verify-production-build.mjs"]);
