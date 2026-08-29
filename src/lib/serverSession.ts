const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

export async function revokeServerSession(token = ""): Promise<void> {
  const value = token.trim();
  try {
    const headers = new Headers();
    if (value) headers.set("authorization", `Bearer ${value}`);
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
      keepalive: true,
    });
  } catch {
    // Explicit local logout still completes if the network is unavailable.
    // The persistent server cookie is cleared on the next successful logout request.
  }
}
