import fs from "node:fs";

const target = new URL("../src/lib/backend.ts", import.meta.url);
const source = fs.readFileSync(target, "utf8");

const startMarker = "async function requestWithRetry<T>(";
const endMarker = "async function uploadEmployeeAvatar(";

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);

if (start === -1 || end === -1 || end <= start) {
  throw new Error(
    "Refusing unsafe backend retry patch: requestWithRetry boundaries were not found.",
  );
}

const currentBlock = source.slice(start, end);

if (currentBlock.includes("const method = String(init.method || \"GET\").toUpperCase();")) {
  console.log("backend request retry safety patch already applied");
  process.exit(0);
}

const replacement = `async function requestWithRetry<T>(
  path: string,
  init: RequestInit = {},
  attempts = 5,
  roleHint?: RoleHint,
): Promise<T> {
  let lastError: unknown;
  const method = String(init.method || "GET").toUpperCase();
  const retryableMethod =
    method === "GET" || method === "HEAD" || method === "OPTIONS";
  const maxAttempts = retryableMethod ? Math.max(1, attempts) : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await waitForOnline();
      await waitForVisible();
      return await request<T>(path, init, roleHint);
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt >= maxAttempts) break;

      const baseDelay = Math.min(8000, 750 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 350);
      await new Promise((resolve) =>
        window.setTimeout(resolve, baseDelay + jitter),
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("تعذر الاتصال بخادم حاضر.");
}
`;

const nextSource = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

fs.writeFileSync(target, nextSource, "utf8");
console.log("backend request retry safety patch applied");
