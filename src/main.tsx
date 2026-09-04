import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/system/AppErrorBoundary";
import "./index.css";
import "./live-ui.css";
import "./label-visibility.css";
import "./settings-page.css";
import "./layout-unified.css";
import "./mobile-layout-width.css";
import "./pull-to-refresh.css";
import "./rotation-form.css";
import "./employee-name.css";
import "./styles/settings-compact.css";
import "./styles/workforce-card-polish.css";
import { seedIfEmpty } from "@/lib/storage";
import { installGlobalDiagnostics, recordDiagnostic } from "@/lib/systemDiagnostics";
import { startRealtimeSync } from "@/lib/realtime";
import { installApiCredentials } from "@/lib/apiCredentials";
import { installDeviceDirectoryEnhancer } from "./deviceDirectoryEnhancer";
import { installNavigationScrollPersistence } from "@/lib/navigationScrollPersistence";
import "@/lib/qrPolyfill";

installApiCredentials();
seedIfEmpty();
installGlobalDiagnostics();
startRealtimeSync();
installDeviceDirectoryEnhancer();
installNavigationScrollPersistence();

if ("serviceWorker" in navigator && window.isSecureContext) {
  const onServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type === "HADIR_SW_UPDATE_AVAILABLE") {
      window.dispatchEvent(new CustomEvent("hadir:sw-update-available"));
    }
  };
  navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);

  window.addEventListener("load", () => {
    const registerServiceWorker = async () => {
      const base = import.meta.env.BASE_URL || "/";
      const baseUrl = new URL(base, window.location.origin);
      const swUrl = new URL("sw.js", baseUrl);
      const scope = baseUrl.pathname;

      // Keep the Service Worker at its canonical URL. The deployed worker
      // itself contains the exact build fingerprint, and updateViaCache:none
      // forces the browser to revalidate that script instead of relying on a
      // cached worker response.
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register(swUrl.toString(), { scope, updateViaCache: "none" });
      } catch (error) {
        // Recover from a previously registered, invalid Service Worker without
        // touching localStorage, IndexedDB, cookies, or the authenticated session.
        const existing = await navigator.serviceWorker.getRegistration(scope).catch(() => undefined);
        if (!existing) throw error;
        const removed = await existing.unregister();
        if (!removed) throw error;
        registration = await navigator.serviceWorker.register(swUrl.toString(), { scope, updateViaCache: "none" });
      }
      const notifyUpdateAvailable = () => {
        window.dispatchEvent(new CustomEvent("hadir:sw-update-available"));
      };

      if (registration.waiting && navigator.serviceWorker.controller) notifyUpdateAvailable();

      void registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdateAvailable();
          }
        });
      });
    };

    void registerServiceWorker().catch(() => undefined);
  });
}

window.addEventListener("unhandledrejection", (event) => {
  recordDiagnostic("error", "APP_UNHANDLED_REJECTION", "حدث خطأ غير معالج في التطبيق.", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
