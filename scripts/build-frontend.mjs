import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const viteEntry = join(root, "node_modules", "vite", "bin", "vite.js");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Cloudflare Pages may invoke `npm run build` while the repository is Bun-managed.
// Bootstrap only when the local dependency tree is absent; normal local/CI builds
// that already installed dependencies remain unchanged.
if (!existsSync(viteEntry)) {
  console.log("Vite is not installed; installing the locked Bun dependency tree...");
  run("bun", ["install", "--frozen-lockfile"]);
}

run(process.execPath, [viteEntry, "build"]);
