const API_URL = (import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").replace(/\/$/, "");

let source: EventSource | null = null;
let reconnectTimer: number | null = null;
let stopped = false;

function getToken(): string { return localStorage.getItem("hadir.api.token") || localStorage.getItem("hadir.auth.token") || ""; }

function connect() {
  if (stopped || typeof window === "undefined") return;
  const token = getToken();
  if (!token || source) return;

  const url = new URL(`${API_URL}/api/realtime`);
  url.searchParams.set("token", token);
  source = new EventSource(url.toString());

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { type?: string };
      if (payload.type === "cloud-data-changed") {
        window.dispatchEvent(new CustomEvent("hadir:cloud-data-changed", { detail: payload }));
        window.dispatchEvent(new Event("hadir:d1-view-changed"));
      }
    } catch { /* ignore malformed realtime messages */ }
  };

  source.onerror = () => {
    source?.close();
    source = null;
    if (!stopped && reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, 2000);
    }
  };
}

export function startRealtimeSync() {
  stopped = false;
  connect();
}

export function stopRealtimeSync() {
  stopped = true;
  source?.close();
  source = null;
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "hadir.api.token" || event.key === "hadir.auth.token") {
      source?.close();
      source = null;
      if (event.newValue) connect();
    }
  });
}
