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
import "./rotation-form.css";
import "./employee-name.css";
import { seedIfEmpty } from "@/lib/storage";
import { installGlobalDiagnostics, recordDiagnostic } from "@/lib/systemDiagnostics";
import { startRealtimeSync } from "@/lib/realtime";
import { installApiCredentials } from "@/lib/apiCredentials";
import { installDeviceDirectoryEnhancer } from "./deviceDirectoryEnhancer";
import { backendMe } from "@/lib/backend";
import { restorePwaSession } from "@/lib/pwaSession";

installApiCredentials();
seedIfEmpty();
installGlobalDiagnostics();
startRealtimeSync();
installDeviceDirectoryEnhancer();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const swUrl = new URL("sw.js?v=6", new URL(base, window.location.origin)).toString();
    const scope = new URL(base, window.location.origin).pathname;
    navigator.serviceWorker.register(swUrl, { scope, updateViaCache: "none" }).catch(() => undefined);
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
    }
  };
  return <button type="button" onClick={install} disabled={busy} aria-label="تثبيت تطبيق حاضر" className="fixed bottom-4 left-4 z-50 rounded-2xl border bg-background/95 px-4 py-3 text-sm font-bold shadow-lg backdrop-blur">
    {busy ? "جاري التثبيت…" : "تثبيت التطبيق"}
  </button>;
}

function StartupSessionGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      let result: any = null;
      try {
        result = await backendMe();
      } catch {
        try {
          result = await restorePwaSession();
        } catch {
          result = null;
        }
      }
      if (cancelled) return;
      const user = result?.user as { id?: string; username?: string; jobNumber?: string; name?: string; role?: string } | undefined;
      const role = String(user?.role || "").toLowerCase();
      if (user?.id && ["employee", "staff"].includes(role)) {
        window.location.replace("/employee");
        return;
      }
      if (user?.id && ["owner", "manager", "supervisor", "admin"].includes(role)) {
        window.location.replace("/manager");
        return;
      }
      setStatus("ready");
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center bg-background">
      <div className="text-sm font-semibold">جاري التحقق من جلسة الدخول…</div>
    </div>;
  }
  return <>{children}</>;
}

function Root() {
  return <StartupSessionGate>
    <App />
    <PwaInstallPrompt />
  </StartupSessionGate>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
  </StrictMode>,
);
