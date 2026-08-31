const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pollTimer: number | null = null;
let stopped = false;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || "";
}

function schedulePoll() {
  if (stopped || typeof window === "undefined" || pollTimer !== null) return;
  pollTimer = window.setInterval(() => {
    if (stopped || !getToken()) return;
    window.dispatchEvent(new Event("hadir:d1-view-changed"));
  }, 15000);
}

function connect() {
  if (stopped || typeof window === "undefined" || socket) return;
  const token = getToken();
  if (!token) { schedulePoll(); return; }
  const wsUrl = API_URL.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/api/realtime?token=" + encodeURIComponent(token);
  try {
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
    ws.onopen = () => schedulePoll();
    ws.onclose = () => {
      if (socket === ws) socket = null;
      schedulePoll();
      if (!stopped && reconnectTimer === null) reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, 30000);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  } catch {
    schedulePoll();
  }
}

export function startRealtimeSync() { stopped = false; schedulePoll(); connect(); }
export function stopRealtimeSync() {
  stopped = true;
  socket?.close();
  socket = null;
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (["hadir.api.token.admin", "hadir.api.token.employee", "hadir.api.token", "hadir.auth.token"].includes(event.key || "")) {
      socket?.close();
      socket = null;
      if (event.newValue) connect();
    }
  });
}
