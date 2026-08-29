import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "hadir.pwa.install.dismissed";
const UPDATE_DISMISSED_KEY = "hadir.pwa.update.dismissed";
const PWA_INSTALL_VERSION = "v3";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function installDismissedThisVersion() {
  try {
    return sessionStorage.getItem(INSTALL_DISMISSED_KEY) === PWA_INSTALL_VERSION;
  } catch {
    return false;
  }
}

export default function PWAExperience() {
  const location = useLocation();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [manualInstallVisible, setManualInstallVisible] = useState(false);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [updating, setUpdating] = useState(false);

  // The install invitation belongs to an authenticated experience. Keeping it
  // off the landing/login screens prevents it from competing with sign-in.
  const installEligible = location.pathname.startsWith("/employee") || location.pathname.startsWith("/manager");

  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => setStandalone(isStandalone());
    media?.addEventListener?.("change", onDisplayModeChange);
    window.addEventListener("pageshow", onDisplayModeChange);
    return () => {
      media?.removeEventListener?.("change", onDisplayModeChange);
      window.removeEventListener("pageshow", onDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const install = event as BeforeInstallPromptEvent;
      setInstallEvent(install);
      setManualInstallVisible(false);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setInstallVisible(false);
      setManualInstallVisible(false);
      setStandalone(true);
      try { sessionStorage.removeItem(INSTALL_DISMISSED_KEY); } catch {}
    };

    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Android/Chromium: once the user reaches the employee or manager area,
  // surface the native install prompt in our existing UI rather than on login.
  useEffect(() => {
    if (!installEligible || standalone || !installEvent || installDismissedThisVersion()) {
      setInstallVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setInstallVisible(true), 450);
    return () => window.clearTimeout(timer);
  }, [installEligible, standalone, installEvent]);

  // iOS/iPadOS has no beforeinstallprompt. Show the same visual invitation,
  // but guide the user through Apple's Share -> Add to Home Screen flow.
  useEffect(() => {
    if (!installEligible || standalone || installEvent || !isIos() || !isMobile() || installDismissedThisVersion()) {
      setManualInstallVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setManualInstallVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, [installEligible, standalone, installEvent, location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const checkForUpdate = async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (!registration || cancelled) return;
      if (registration.waiting && navigator.serviceWorker.controller) {
        if (sessionStorage.getItem(UPDATE_DISMISSED_KEY) !== "1") setUpdateVisible(true);
        return;
      }
      const worker = registration.installing;
      if (!worker) return;
      const onStateChange = () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller && sessionStorage.getItem(UPDATE_DISMISSED_KEY) !== "1") {
          setUpdateVisible(true);
        }
      };
      worker.addEventListener("statechange", onStateChange);
    };
    void checkForUpdate();
    const timer = window.setInterval(() => void checkForUpdate(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onControllerChange = () => {
      setUpdating(false);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const dismissInstall = () => {
    try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, PWA_INSTALL_VERSION); } catch {}
    setInstallVisible(false);
    setManualInstallVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setInstallVisible(false);
    if (choice.outcome === "dismissed") {
      try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, PWA_INSTALL_VERSION); } catch {}
    }
  };

  const update = async () => {
    setUpdating(true);
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    await registration?.update().catch(() => undefined);
    setUpdating(false);
  };

  const dismissUpdate = () => {
    sessionStorage.setItem(UPDATE_DISMISSED_KEY, "1");
    setUpdateVisible(false);
  };

  if (offline) {
    return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-xl">📡</div><div className="min-w-0 flex-1"><p className="font-bold">أنت غير متصل بالإنترنت</p><p className="mt-0.5 text-xs text-muted-foreground">تم الحفاظ على جلسة الدخول. سيُستأنف الاتصال تلقائيًا عند عودته.</p></div></div></div>;
  }

  if (updateVisible) {
    return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">✨</div><div className="min-w-0 flex-1"><p className="font-bold">تحديث جديد لحاضر متاح</p><p className="mt-1 text-xs leading-5 text-muted-foreground">سيتم تحديث واجهة التطبيق بأمان دون حذف بياناتك المحلية أو جلسة تسجيل الدخول.</p><div className="mt-3 flex gap-2"><button type="button" onClick={update} disabled={updating} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{updating ? "جارٍ التحديث…" : "تحديث الآن"}</button><button type="button" onClick={dismissUpdate} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">لاحقًا</button></div></div><button type="button" aria-label="إغلاق" onClick={dismissUpdate} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  }

  if (installVisible && installEvent && installEligible) {
    return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10"><img src="/pwa-icon.svg" alt="" className="size-9" /></div><div className="min-w-0 flex-1"><p className="font-bold">ثبّت حاضر كتطبيق</p><p className="mt-1 text-xs leading-5 text-muted-foreground">أضف حاضر إلى جهازك للوصول السريع وتشغيله كتطبيق مستقل. حسابك وبياناتك لا تتأثر بالتثبيت.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void install()} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">تثبيت الآن</button><button type="button" onClick={dismissInstall} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">ليس الآن</button></div></div><button type="button" aria-label="إغلاق" onClick={dismissInstall} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  }

  if (manualInstallVisible && isIos() && isMobile() && installEligible) {
    return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10"><img src="/pwa-icon.svg" alt="حاضر" className="size-9" /></div><div className="min-w-0 flex-1"><p className="font-bold">ثبّت حاضر على iPhone</p><p className="mt-1 text-xs leading-6 text-muted-foreground">اضغط زر المشاركة <span aria-hidden="true">⬆️</span> في Safari، ثم اختر «إضافة إلى الشاشة الرئيسية» ليظهر حاضر كتطبيق مستقل على جهازك.</p><button type="button" onClick={dismissInstall} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">فهمت</button></div><button type="button" aria-label="إغلاق" onClick={dismissInstall} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  }

  return null;
}
