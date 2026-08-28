import { StrictMode, useEffect, useState } from "react";
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
import { seedIfEmpty } from "@/lib/storage";
import { installGlobalDiagnostics, recordDiagnostic } from "@/lib/systemDiagnostics";
import { startRealtimeSync } from "@/lib/realtime";
import { installApiCredentials } from "@/lib/apiCredentials";
import { installDeviceDirectoryEnhancer } from "./deviceDirectoryEnhancer";

installApiCredentials();
seedIfEmpty();
installGlobalDiagnostics();
startRealtimeSync();
installDeviceDirectoryEnhancer();

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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  const install = async () => {
    if (!installEvent || busy) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setBusy(false);
      setInstallEvent(null);
    }
  };

  return (
    <aside className="hadir-install-card" dir="rtl" aria-label="تثبيت تطبيق حاضر">
      <img className="hadir-install-icon" src="/favicon.svg" alt="شعار حاضر" />
      <div className="hadir-install-copy">
        <strong>ثبّت تطبيق حاضر</strong>
        <span>وصول أسرع من شاشة هاتفك وتجربة مستقلة بدون شريط المتصفح.</span>
      </div>
      <button className="hadir-install-button" type="button" onClick={() => void install()} disabled={busy}>
        {busy ? "جارٍ التثبيت…" : "تثبيت"}
      </button>
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <PwaInstallPrompt />
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
