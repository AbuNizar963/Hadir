import { sendPushNotification, type PushSubscriptionData } from "@mmmike/web-push/send";

export type PushEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

export async function sendUserPush(env: PushEnv, subscription: PushSubscriptionData, payload: { title: string; body: string; url?: string; tag?: string; type?: string }) {
  const publicKey = String(env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(env.VAPID_SUBJECT || "").trim();
  if (!publicKey || !privateKey || !subject) return { ok: false, configured: false };
  try {
    const result = await sendPushNotification(subscription, {
      title: payload.title,
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || `hadir-${payload.type || "notification"}`,
      data: { url: payload.url || "/", type: payload.type || "info" },
    }, { publicKey, privateKey, subject });
    return { ok: Boolean(result), configured: true };
  } catch (error) {
    const status = Number((error as any)?.status || (error as any)?.statusCode || 0);
    return { ok: false, configured: true, status, error: error instanceof Error ? error.message : String(error) };
  }
}
