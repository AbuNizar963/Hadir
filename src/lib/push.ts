const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const ADMIN_TOKEN_KEY = "hadir.api.token.admin";
const EMPLOYEE_TOKEN_KEY = "hadir.api.token.employee";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function authHeaders() {
  const headers = new Headers({ "content-type": "application/json" });
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY)?.trim() || localStorage.getItem(EMPLOYEE_TOKEN_KEY)?.trim() || "";
    if (token) headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function enableWebPush(userId: string): Promise<"enabled" | "denied" | "unsupported" | "unconfigured" | "failed"> {
  if (!userId || typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  try {
    let vapidPublicKey = VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      const keyResponse = await fetch(`${API_URL}/api/push/public-key`, { cache: "no-store" });
      if (keyResponse.ok) vapidPublicKey = String(((await keyResponse.json()) as any)?.publicKey || "").trim();
    }
    if (!vapidPublicKey) return "unconfigured";

    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const response = await fetch(`${API_URL}/api/push/subscription`, {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
    });
    if (!response.ok) return "failed";
    return "enabled";
  } catch {
    return "failed";
  }
}
