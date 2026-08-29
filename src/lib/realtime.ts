const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15000;
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectDelay = RECONNECT_MIN_MS;
let stopped = false;
let lastToken = "";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("hadir.api.token.admin") || localStorage.getItem("hadir.api.token.employee") || localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || "";
}

function emitSyncState(state: "connected" | "disconnected" | "reconnecting") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hadir:realtime-state", { detail: { state } }));
}

function scheduleReconnect() {
  if (stopped || reconnectTimer !== null || !getToken()) return;
  const delay = reconnectDelay;
  reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
  emitSyncState("reconnecting");
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function closeSocket() {
  const current = socket;
  socket = null;
  if (current) {
    try { current.close(); } catch { /* ignore */ }
  }
}

function connect() {
  if (stopped || typeof window === "undefined" || typeof WebSocket === "undefined") return;
  if (document.visibilityState === "hidden" || navigator.onLine === false) return;

  const token = getToken();
  if (!token) {
    lastToken = "";
    closeSocket();
    return;
  }

  if (socket && lastToken === token && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (socket && lastToken !== token) closeSocket();

  lastToken = token;
  const wsUrl = API_URL.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/api/realtime?token=" + encodeURIComponent(token);
  const ws = new WebSocket(wsUrl);
  socket = ws;

  ws.onopen = () => {
    if (socket !== ws) return;
    reconnectDelay = RECONNECT_MIN_MS;
    emitSyncState("connected");
    window.dispatchEvent(new Event("hadir:d1-view-changed"));
  };

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
    if (!stopped) {
      emitSyncState("disconnected");
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    try { ws.close(); } catch { /* ignore */ }
  };
}

function refreshConnection() {
  if (stopped || typeof window === "undefined") return;
  const token = getToken();
  if (!token) {
    lastToken = "";
    closeSocket();
    return;
  }
  if (token !== lastToken) {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnectDelay = RECONNECT_MIN_MS;
    closeSocket();
  }
  connect();
}

export function startRealtimeSync() {
  stopped = false;
  reconnectDelay = RECONNECT_MIN_MS;
  refreshConnection();
}

export function stopRealtimeSync() {
  stopped = true;
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  closeSocket();
  emitSyncState("disconnected");
}

if (typeof window !== "undefined") {
  const refreshEvents = ["online", "focus", "pageshow", "visibilitychange"];
  for (const eventName of refreshEvents) window.addEventListener(eventName, refreshConnection);

  window.addEventListener("storage", (event) => {
    if (["hadir.api.token.admin", "hadir.api.token.employee", "hadir.api.token", "hadir.auth.token"].includes(event.key || "")) refreshConnection();
  });

  // Login/logout in the same tab does not fire the browser's storage event.
  window.addEventListener("hadir:auth-changed", refreshConnection);
}
