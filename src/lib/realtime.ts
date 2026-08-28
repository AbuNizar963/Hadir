const API_URL = "https://hadir-api.abunizar963.workers.dev";
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let stopped = false;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || "";
}

function connect() {
  if (stopped || typeof window === "undefined" || socket) return;
  const token = getToken();
  if (!token) return;
  const wsUrl = API_URL.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/api/realtime?token=" + encodeURIComponent(token);
  const ws = new WebSocket(wsUrl);
  socket = ws;

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as { type?: string };
      if (payload.type === "cloud-data-changed") {
        window.dispatchEvent(new CustomEvent("hadir:cloud-data-changed", { detail: payload }));
        window.dispatchEvent(new Event("hadir:d1-view-changed"));
      }
    } catch { /* ignore malformed realtime messages */ }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (!stopped && reconnectTimer === null) reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, 2000);
  };
  ws.onerror = () => { ws.close(); };
}

export function startRealtimeSync() { stopped = false; connect(); }
export function stopRealtimeSync() { stopped = true; socket?.close(); socket = null; if (reconnectTimer !== null) window.clearTimeout(reconnectTimer); reconnectTimer = null; }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (["hadir.api.token.admin", "hadir.api.token.employee", "hadir.api.token", "hadir.auth.token"].includes(event.key || "")) { socket?.close(); socket = null; if (event.newValue) connect(); }
  });
}
