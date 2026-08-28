import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const vitePackage = new URL("../node_modules/vite/package.json", import.meta.url);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Cloudflare Pages can be configured to skip its automatic dependency install.
// Keep the build self-sufficient without reinstalling when dependencies already exist.
if (!existsSync(vitePackage)) {
  if (process.platform === "win32") {
    run("bun", ["install", "--frozen-lockfile"]);
  } else {
    const bun = spawnSync("bun", ["--version"], { stdio: "ignore", shell: false });
    if (bun.status === 0 && !bun.error) {
      run("bun", ["install", "--frozen-lockfile"]);
    } else {
      run("npm", ["install", "--include=dev"]);
    }
  }
}

run("bun", ["run", "vite", "build"]);
