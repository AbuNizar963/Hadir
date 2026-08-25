export interface RealtimeEnv {
  REALTIME: DurableObjectNamespace;
}

export class HadirRealtime {
  private readonly sessions = new Map<string, WebSocket>();

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!userId) return new Response("Missing userId", { status: 400 });

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      this.sessions.set(userId, server);

      server.addEventListener("close", () => {
        if (this.sessions.get(userId) === server) this.sessions.delete(userId);
      });
      server.addEventListener("error", () => {
        if (this.sessions.get(userId) === server) this.sessions.delete(userId);
      });

      server.send(JSON.stringify({ type: "connected", userId, timestamp: new Date().toISOString() }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.json().catch(() => null);
      if (!payload) return new Response("Invalid payload", { status: 400 });

      const message = JSON.stringify(payload);
      for (const [userId, socket] of this.sessions) {
        try {
          socket.send(message);
        } catch {
          this.sessions.delete(userId);
        }
      }
      return Response.json({ ok: true, delivered: this.sessions.size });
    }

    return new Response("Not found", { status: 404 });
  }
}
