const PWA_SESSION_STORAGE_KEYS = {
  employee: "hadir_pwa_token.employee",
  admin: "hadir_pwa_token.admin",
} as const;
const LEGACY_PWA_SESSION_STORAGE_KEY = "hadir_pwa_token";
const PWA_DB_NAME = "hadir-auth";
const PWA_DB_VERSION = 2;
const PWA_STORE = "session";
const PWA_KEYS = { employee: "employee", admin: "admin" } as const;
type PwaRole = keyof typeof PWA_SESSION_STORAGE_KEYS;
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

async function writeIndexedSession(role: PwaRole, token: string): Promise<void> {
  const db = await openSessionDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PWA_STORE, "readwrite");
    tx.objectStore(PWA_STORE).put({ token, savedAt: Date.now() } satisfies StoredSession, PWA_KEYS[role]);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("PWA_IDB_WRITE_FAILED"));
    tx.onabort = () => reject(tx.error || new Error("PWA_IDB_WRITE_ABORTED"));
  });
  db.close();
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

async function readIndexedSession(role: PwaRole): Promise<string> {
  try {
    const db = await openSessionDb();
    const stored = await new Promise<StoredSession | undefined>((resolve, reject) => {
      const tx = db.transaction(PWA_STORE, "readonly");
      const request = tx.objectStore(PWA_STORE).get(PWA_KEYS[role]);
      request.onsuccess = () => resolve(request.result as StoredSession | undefined);
      request.onerror = () => reject(request.error || new Error("PWA_IDB_READ_FAILED"));
    });
    db.close();
    return typeof stored?.token === "string" ? stored.token : "";
  } catch { return ""; }
}

async function deleteIndexedSession(role: PwaRole): Promise<void> {
  try {
    const db = await openSessionDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PWA_STORE, "readwrite");
      tx.objectStore(PWA_STORE).delete(PWA_KEYS[role]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    db.close();
  } catch { /* best effort */ }
}

export async function persistPwaSession(token: string, role?: PwaRole): Promise<void> {
  if (!isBrowser() || !token) return;
  const resolvedRole = role || "employee";
  try { localStorage.setItem(PWA_SESSION_STORAGE_KEYS[resolvedRole], token); } catch { /* best effort */ }
  await writeIndexedSession(resolvedRole, token).catch(() => undefined);
}

export function clearPwaSession(role?: PwaRole): void {
  if (!isBrowser()) return;
  if (role) {
    try { localStorage.removeItem(PWA_SESSION_STORAGE_KEYS[role]); } catch { /* best effort */ }
    void deleteIndexedSession(role);
    return;
  }
  for (const key of Object.values(PWA_SESSION_STORAGE_KEYS)) {
    try { localStorage.removeItem(key); } catch { /* best effort */ }
  }
  try { localStorage.removeItem(LEGACY_PWA_SESSION_STORAGE_KEY); } catch { /* best effort */ }
  void Promise.all((Object.keys(PWA_SESSION_STORAGE_KEYS) as PwaRole[]).map(deleteIndexedSession));
}

export function getPwaSessionToken(role?: PwaRole): string {
  if (!isBrowser()) return "";
  if (role) {
    try { return localStorage.getItem(PWA_SESSION_STORAGE_KEYS[role]) || ""; } catch { return ""; }
  }
  try { return localStorage.getItem(PWA_SESSION_STORAGE_STORAGE_KEY as never) || ""; } catch { return ""; }
}

async function recoverRole(role: PwaRole): Promise<any> {
  let token = getPwaSessionToken(role);
  if (!token) token = await readIndexedSession(role);
  if (!token) return null;

  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await deleteIndexedSession(role);
    try { localStorage.removeItem(PWA_SESSION_STORAGE_KEYS[role]); } catch { /* best effort */ }
    return null;
  }

  try {
    const actualRole = String(data?.user?.role || "").toLowerCase();
    const isAdmin = ["owner", "manager", "supervisor", "admin"].includes(actualRole);
    const isEmployee = ["employee", "staff"].includes(actualRole);
    if ((role === "admin" && !isAdmin) || (role === "employee" && !isEmployee)) return null;
    localStorage.setItem(role === "admin" ? "hadir.api.token.admin" : "hadir.api.token.employee", token);
  } catch { /* best effort */ }
  return data;
}

export async function restorePwaSession(role?: PwaRole): Promise<any> {
  const roles: PwaRole[] = role ? [role] : ["employee", "admin"];
  for (const candidate of roles) {
    try {
      const data = await recoverRole(candidate);
      if (data?.user) return data;
    } catch { /* try the other persisted role */ }
  }
  throw new Error("PWA_SESSION_MISSING");
}
