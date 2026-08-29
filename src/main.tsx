import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/system/AppErrorBoundary";
import "./index.css";
import "./live-ui.css";
import "./label-visibility.css";
import "./settings-page.css";
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
    const swUrl = new URL("sw.js?v=10", new URL(base, window.location.origin)).toString();
    const scope = new URL(base, window.location.origin).pathname;
    navigator.serviceWorker.register(swUrl, { scope, updateViaCache: "none" }).then((registration) => {
      void registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "HADIR_SKIP_WAITING" });
        });
      });
    }).catch(() => undefined);
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
    window.setInterval(() => { void navigator.serviceWorker.getRegistration(scope).then((registration) => registration?.update()).catch(() => undefined); }, 5 * 60 * 1000);
  });
}

window.addEventListener("unhandledrejection", (event) => {
  recordDiagnostic("error", "APP_UNHANDLED_REJECTION", "حدث خطأ غير معالج في التطبيق.", event.reason);
});

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const PWA_INSTALL_DISMISSED_KEY = "hadir.pwa.installPrompt.dismissed";

function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone);
    try { setDismissed(localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === "1"); } catch {}
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "1"); } catch {} };
  const install = async () => { if (!installEvent || busy) return; setBusy(true); try { await installEvent.prompt(); const choice = await installEvent.userChoice; if (choice.outcome === "accepted") { setInstalled(true); setInstallEvent(null); } else dismiss(); } finally { setBusy(false); } };
  if (installed || dismissed || !installEvent) return null;
  return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-base font-extrabold">ثبّت تطبيق حاضر</div><div className="mt-1 text-sm text-muted-foreground">وصول أسرع من شاشة هاتفك وتجربة مستقلة بدون شريط المتصفح.</div></div><button type="button" onClick={dismiss} aria-label="إغلاق" className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted">×</button></div><div className="mt-3 flex gap-2"><button type="button" onClick={install} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "جاري التثبيت…" : "تثبيت"}</button><button type="button" onClick={dismiss} className="rounded-xl border px-4 py-2 text-sm font-semibold">إغلاق</button></div></div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><AppErrorBoundary><App /><PwaInstallPrompt /></AppErrorBoundary></StrictMode>);
