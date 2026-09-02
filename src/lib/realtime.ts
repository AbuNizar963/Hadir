const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pollTimer: number | null = null;
let stopped = false;
let connected = false;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || "";
}

function clearPoll() {
  if (typeof window === "undefined") return;
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
}

function scheduleFallbackPoll() {
  if (stopped || connected || typeof window === "undefined" || pollTimer !== null || !getToken()) return;
  pollTimer = window.setInterval(() => {
    if (stopped || connected || !getToken() || document.visibilityState !== "visible") return;
    window.dispatchEvent(new Event("hadir:d1-view-changed"));
  }, 120000);
}

function connect() {
  if (stopped || typeof window === "undefined" || socket) return;
  const token = getToken();
  if (!token) {
    connected = false;
    scheduleFallbackPoll();
    return;
  }
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
    ws.onopen = () => {
      connected = true;
      clearPoll();
      window.dispatchEvent(new CustomEvent("hadir:realtime-status", { detail: { connected: true } }));
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      connected = false;
      window.dispatchEvent(new CustomEvent("hadir:realtime-status", { detail: { connected: false } }));
      scheduleFallbackPoll();
      if (!stopped && reconnectTimer === null) reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, 30000);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  } catch {
    connected = false;
    scheduleFallbackPoll();
  }
}

export function startRealtimeSync() {
  stopped = false;
  connected = false;
  clearPoll();
  connect();
}

export function stopRealtimeSync() {
  stopped = true;
  connected = false;
  socket?.close();
  socket = null;
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  clearPoll();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (["hadir.api.token.admin", "hadir.api.token.employee", "hadir.api.token", "hadir.auth.token"].includes(event.key || "")) {
      clearPoll();
      socket?.close();
      socket = null;
      connected = false;
      if (event.newValue) connect();
      else window.dispatchEvent(new CustomEvent("hadir:realtime-status", { detail: { connected: false } }));
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (getToken() && !socket) connect();
      window.dispatchEvent(new Event("hadir:d1-view-changed"));
    }
  });
}
