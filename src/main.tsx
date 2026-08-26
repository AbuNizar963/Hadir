import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./live-ui.css";
import "./label-visibility.css";
import "./settings-page.css";
import "./layout-unified.css";
import "./mobile-layout-width.css";
import "./pull-to-refresh.css";
import { seedIfEmpty } from "@/lib/storage";
import { installGlobalDiagnostics, recordDiagnostic } from "@/lib/systemDiagnostics";
import { startRealtimeSync } from "@/lib/realtime";
import { installApiCredentials } from "@/lib/apiCredentials";

installApiCredentials();
seedIfEmpty();
installGlobalDiagnostics();
startRealtimeSync();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const swUrl = new URL("sw.js", new URL(base, window.location.origin)).toString();
    const scope = new URL(base, window.location.origin).pathname;
    navigator.serviceWorker.register(swUrl, { scope }).catch(() => undefined);
  });
}

window.addEventListener("unhandledrejection", (event) => {
  recordDiagnostic("error", "APP_UNHANDLED_REJECTION", "حدث خطأ غير معالج في التطبيق.", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);