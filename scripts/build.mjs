import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const vitePackage = new URL("../node_modules/vite/package.json", import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) return false;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return true;
}

// Cloudflare Pages can be configured to skip its automatic dependency install.
// Keep the build self-sufficient without reinstalling when dependencies already exist.
if (!existsSync(vitePackage)) {
  const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
  if (bun.status === 0 && !bun.error) {
    run("bun", ["install", "--frozen-lockfile"]);
  } else {
    run("npm", ["install", "--include=dev", "--no-audit", "--no-fund"]);
  }
}

// Repair the generated report patch before it is executed. This keeps the
// historical patch chain buildable without changing attendance data.
run("node", ["scripts/repair-manager-report-patch.mjs"]);
run("node", ["scripts/patch-manager-reports-final.mjs"]);
run("node", ["scripts/patch-manager-reports-final2.mjs"]);

const gitSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha.stdout?.trim() || "unknown";
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "unknown";
const deploymentUrl = process.env.CF_PAGES_URL || "";

const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
if (bun.status === 0 && !bun.error) {
  if (!run("bun", ["run", "vite", "build"])) {
    run("npm", ["run", "build"]);
  }
} else {
  run("npm", ["run", "build"]);
}

// Version the project favicon URL in the emitted production files using the
// exact build commit. The file itself remains public/favicon.svg, so there is
// still one source of truth; only its URL changes between deployments. This
// gives browsers and installed PWAs a fresh icon resource whenever the build
// changes, avoiding stale launcher/service-worker icon URLs.
const faviconVersion = encodeURIComponent(commitSha);
const emittedFiles = ["index.html", "manifest.webmanifest", "sw.js"];
for (const fileName of emittedFiles) {
  const fileUrl = new URL(`../dist/${fileName}`, import.meta.url);
  if (!existsSync(fileUrl)) continue;
  const content = readFileSync(fileUrl, "utf8");
  const versioned = content
    .replaceAll("./favicon.svg", `./favicon.svg?v=${faviconVersion}`)
    .replaceAll("/favicon.svg", `/favicon.svg?v=${faviconVersion}`);
  if (versioned !== content) {
    writeFileSync(fileUrl, versioned, "utf8");
  }
}

// Vite copies public/sw.js verbatim. Inject the exact build commit into the
// emitted worker so every production deployment produces a genuinely new
// Service Worker, even when only application source files changed.
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

// Emit a deployment fingerprint from the actual commit used by the builder.
// Cloudflare Pages exposes CF_PAGES_COMMIT_SHA for Git-integrated builds;
// GitHub Actions exposes GITHUB_SHA for its own verification build.
mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/build-version.json", import.meta.url),
  `${JSON.stringify({ commitSha, branch, deploymentUrl }, null, 2)}\n`,
  "utf8",
);
