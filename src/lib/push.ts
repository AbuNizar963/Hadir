const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function enableWebPush(userId: string): Promise<"enabled" | "denied" | "unsupported" | "unconfigured" | "failed"> {
  if (!userId || typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  try {
  let vapidPublicKey = VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    const keyResponse = await fetch(`${API_URL}/api/push/public-key`, { credentials: "include", cache: "no-store" });
    if (keyResponse.ok) vapidPublicKey = String(((await keyResponse.json()) as any)?.publicKey || "").trim();
  }
  if (!vapidPublicKey) return "unconfigured";
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const response = await fetch(`${API_URL}/api/push/subscription`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
    });
    if (!response.ok) return "failed";
    return "enabled";
  } catch {
    return "failed";
  }
}
