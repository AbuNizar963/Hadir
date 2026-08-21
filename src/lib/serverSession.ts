const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

export async function revokeServerSession(token: string): Promise<void> {
  const value = token.trim();
  if (!value) return;
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { authorization: `Bearer ${value}` },
      keepalive: true,
    });
  } catch {
    // Local logout must still complete if the network is unavailable.
    // The server session can be revoked by a later cleanup request.
  }
}
