import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const vitePackage = new URL("../node_modules/vite/package.json", import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) return false;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return true;
}

if (!existsSync(vitePackage)) {
  const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
  if (bun.status === 0 && !bun.error) {
    run("bun", ["install", "--frozen-lockfile"]);
  } else {
    run("npm", ["install", "--include=dev", "--no-audit", "--no-fund"]);
  }
}

run("node", ["scripts/repair-manager-report-patch.mjs"]);
run("node", ["scripts/patch-manager-reports-final.mjs"]);
run("node", ["scripts/patch-manager-reports-final2.mjs"]);
run("node", ["scripts/patch-employee-form-defaults.mjs"]);
run("node", ["scripts/patch-manager-employee-save.mjs"]);

// Keep employee editing fixes in the production build path as a deterministic patch.

const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
if (bun.status === 0 && !bun.error) {
  if (!run("bun", ["run", "vite", "build"])) {
    run("npm", ["run", "build"]);
  }
} else {
  run("npm", ["run", "build"]);
}

const gitSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const commitSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha.stdout?.trim() || "unknown";
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_REF_NAME || "unknown";
const deploymentUrl = process.env.CF_PAGES_URL || "";

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/build-version.json", import.meta.url),
  `${JSON.stringify({ commitSha, branch, deploymentUrl}, null, 2)}\n`,
  "utf8",
);
