const PWA_SESSION_COOKIE = "hadir_pwa_session";
const PWA_SESSION_STORAGE_KEY = "hadir_pwa_token";
const PWA_SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 5;
const PWA_DB_NAME = "hadir-auth";
const PWA_DB_VERSION = 1;
const PWA_STORE = "session";
const PWA_KEY = "active";

type StoredSession = { token: string; savedAt: number };

function isBrowser() { return typeof window !== "undefined" && typeof document !== "undefined"; }

function openSessionDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || !window.indexedDB) { reject(new Error("PWA_IDB_UNAVAILABLE")); return; }
    const request = window.indexedDB.open(PWA_DB_NAME, PWA_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PWA_STORE)) db.createObjectStore(PWA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("PWA_IDB_OPEN_FAILED"));
  });
}

async function writeIndexedSession(token: string): Promise<void> {
  const db = await openSessionDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PWA_STORE, "readwrite");
    tx.objectStore(PWA_STORE).put({ token, savedAt: Date.now() } satisfies StoredSession, PWA_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("PWA_IDB_WRITE_FAILED"));
    tx.onabort = () => reject(tx.error || new Error("PWA_IDB_WRITE_ABORTED"));
  });
  db.close();
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

async function readIndexedSession(): Promise<string> {
  try {
    const db = await openSessionDb();
    const stored = await new Promise<StoredSession | undefined>((resolve, reject) => {
      const tx = db.transaction(PWA_STORE, "readonly");
      const request = tx.objectStore(PWA_STORE).get(PWA_KEY);
      request.onsuccess = () => resolve(request.result as StoredSession | undefined);
      request.onerror = () => reject(request.error || new Error("PWA_IDB_READ_FAILED"));
    });
    db.close();
    return typeof stored?.token === "string" ? stored.token : "";
  } catch {
    return "";
  }
}

async function deleteIndexedSession(): Promise<void> {
  try {
    const db = await openSessionDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PWA_STORE, "readwrite");
      tx.objectStore(PWA_STORE).delete(PWA_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    db.close();
  } catch { /* best effort */ }
}

export function persistPwaSession(token: string): void {
  if (!isBrowser() || !token) return;
  // Synchronous durable fallback: unlike sessionStorage, localStorage survives
  // closing/reopening the browser and standalone PWA window.
  try { localStorage.setItem(PWA_SESSION_STORAGE_KEY, token); } catch { /* best effort */ }
  document.cookie = `${PWA_SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${PWA_SESSION_MAX_AGE}; Path=/; Secure; SameSite=Lax`;
  void writeIndexedSession(token);
}

export function clearPwaSession(): void {
  if (!isBrowser()) return;
  try { localStorage.removeItem(PWA_SESSION_STORAGE_KEY); } catch { /* best effort */ }
  document.cookie = `${PWA_SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
  void deleteIndexedSession();
}

export function getPwaSessionToken(): string {
  if (!isBrowser()) return "";
  try {
    const stored = localStorage.getItem(PWA_SESSION_STORAGE_KEY);
    if (stored) return stored;
  } catch { /* best effort */ }
  const prefix = `${PWA_SESSION_COOKIE}=`;
  const item = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

/**
 * Persistent PWA recovery. The server's HttpOnly `hadir_session` remains the
 * primary session. A durable browser-side copy is used only as a recovery
 * credential for standalone PWAs when the normal cookie context is unavailable.
 */
export async function restorePwaSession(): Promise<any> {
  const token = getPwaSessionToken() || await readIndexedSession();
  if (!token) throw new Error("PWA_SESSION_MISSING");
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await deleteIndexedSession();
    try { localStorage.removeItem(PWA_SESSION_STORAGE_KEY); } catch { /* best effort */ }
    throw new Error(typeof data?.error === "string" ? data.error : `PWA_SESSION_INVALID_${response.status}`);
  }

  // Rehydrate the normal role token too, so every existing API call continues
  // to use the same recovered credential after a standalone restart.
  try {
    const role = String(data?.user?.role || "").toLowerCase();
    if (["owner", "manager", "supervisor", "admin"].includes(role)) {
      localStorage.setItem("hadir.api.token.admin", token);
      localStorage.removeItem("hadir.api.token.employee");
    } else if (["employee", "staff"].includes(role)) {
      localStorage.setItem("hadir.api.token.employee", token);
      localStorage.removeItem("hadir.api.token.admin");
    }
  } catch { /* best effort */ }

  return data;
}
