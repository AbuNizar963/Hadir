import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

// Apply the validated report correction before Vite compiles the app.
run("node", ["scripts/patch-manager-reports-final.mjs"]);

const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
if (bun.status === 0 && !bun.error) {
  if (!run("bun", ["run", "vite", "build"])) {
    run("npm", ["run", "build"]);
  }
} else {
  run("npm", ["run", "build"]);
}

// Emit a deployment fingerprint from the actual commit used by the builder.
// Cloudflare Pages exposes CF_PAGES_COMMIT_SHA for Git-integrated builds;
// GitHub Actions exposes GITHUB_SHA for its own verification build.
const gitSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha.stdout?.trim() || "unknown";
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "unknown";
const deploymentUrl = process.env.CF_PAGES_URL || "";

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/build-version.json", import.meta.url),
  `${JSON.stringify({ commitSha, branch, deploymentUrl }, null, 2)}\n`,
  "utf8",
);
