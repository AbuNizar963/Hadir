import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };
const INSTALL_DISMISSED_KEY = "hadir.pwa.install.dismissed";
const UPDATE_DISMISSED_KEY = "hadir.pwa.update.dismissed";
const UPDATE_BUILD_VERSION_KEY = "hadir.pwa.last-open-build-version";
const PWA_INSTALL_VERSION = "v3";
function isStandalone() { if (typeof window === "undefined") return false; return window.matchMedia?.("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)); }
function isAndroidTwa() { if (typeof document === "undefined") return false; return /^android-app:\/\//i.test(document.referrer); }
function isIos() { if (typeof navigator === "undefined") return false; return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function isAndroid() { return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent); }
function isMobile() { if (typeof navigator === "undefined") return false; return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent); }
function installDismissedThisVersion() { try { return sessionStorage.getItem(INSTALL_DISMISSED_KEY) === PWA_INSTALL_VERSION; } catch { return false; } }

export default function PWAExperience() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [manualInstallVisible, setManualInstallVisible] = useState(false);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const detectedBuildVersionRef = useRef("");
  const pendingBuildVersionRef = useRef("");

  useEffect(() => { const media = window.matchMedia?.("(display-mode: standalone)"); const onDisplayModeChange = () => setStandalone(isStandalone()); media?.addEventListener?.("change", onDisplayModeChange); window.addEventListener("pageshow", onDisplayModeChange); return () => { media?.removeEventListener?.("change", onDisplayModeChange); window.removeEventListener("pageshow", onDisplayModeChange); }; }, []);
  useEffect(() => {
    const onBeforeInstall = (event: Event) => { event.preventDefault(); const install = event as BeforeInstallPromptEvent; setInstallEvent(install); setManualInstallVisible(false); if (!standalone && !installDismissedThisVersion()) window.setTimeout(() => setInstallVisible(true), 300); };
    const onInstalled = () => { setInstallEvent(null); setInstallVisible(false); setManualInstallVisible(false); setStandalone(true); try { sessionStorage.removeItem(INSTALL_DISMISSED_KEY); } catch {} };
    const onOnline = () => setOffline(false); const onOffline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall); window.addEventListener("appinstalled", onInstalled); window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [standalone]);
  useEffect(() => { if (standalone || installEvent || installDismissedThisVersion() || !isMobile()) return; const timer = window.setTimeout(() => { if (!isStandalone()) setManualInstallVisible(true); }, 2200); return () => window.clearTimeout(timer); }, [standalone, installEvent]);

  useEffect(() => {
    let cancelled = false;
    let observedWorker: ServiceWorker | null = null;
    const twa = isAndroidTwa();

    const shouldShowUpdate = () => {
      // Native Android TWA updates with the APK/web content flow, not the browser PWA prompt.
      // The PWA update prompt remains enabled for an actually installed standalone PWA.
      if (twa || !isStandalone()) return;
      try {
        if (!cancelled && sessionStorage.getItem(UPDATE_DISMISSED_KEY) !== "1") setUpdateVisible(true);
      } catch {
        if (!cancelled) setUpdateVisible(true);
      }
    };

    const onServiceWorkerUpdateAvailable = () => shouldShowUpdate();
    window.addEventListener("hadir:sw-update-available", onServiceWorkerUpdateAvailable);

    const observeInstallingWorker = (worker: ServiceWorker) => {
      if (observedWorker === worker) return;
      observedWorker = worker;
      const onStateChange = () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) shouldShowUpdate();
      };
      worker.addEventListener("statechange", onStateChange);
    };

    const getBuildVersion = async () => {
      const base = import.meta.env.BASE_URL || "/";
      const url = new URL("build-version.json", new URL(base, window.location.origin));
      url.searchParams.set("check", String(Date.now()));
      const response = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return "";
      const data = await response.json().catch(() => null) as { commitSha?: unknown } | null;
      return typeof data?.commitSha === "string" ? data.commitSha.trim() : "";
    };

    const checkDeploymentVersion = async () => {
      if (cancelled || !navigator.onLine || twa) return;
      try {
        const buildVersion = await getBuildVersion();
        if (!buildVersion || cancelled) return;
        detectedBuildVersionRef.current = buildVersion;
        let lastOpenBuildVersion = "";
        try { lastOpenBuildVersion = localStorage.getItem(UPDATE_BUILD_VERSION_KEY)?.trim() || ""; } catch {}
        if (!lastOpenBuildVersion) {
          try { localStorage.setItem(UPDATE_BUILD_VERSION_KEY, buildVersion); } catch {}
          return;
        }
        if (buildVersion !== lastOpenBuildVersion) {
          pendingBuildVersionRef.current = buildVersion;
          shouldShowUpdate();
          return;
        }
      } catch {
        // A failed version check must never interrupt the running application.
      }
    };

    const checkForUpdate = async () => {
      if (cancelled || twa || !("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (!registration || cancelled) return;

      if (registration.waiting && navigator.serviceWorker.controller) {
        shouldShowUpdate();
        return;
      }

      if (registration.installing) observeInstallingWorker(registration.installing);
      await registration.update().catch(() => undefined);
      if (cancelled) return;

      if (registration.waiting && navigator.serviceWorker.controller) shouldShowUpdate();
      if (registration.installing) observeInstallingWorker(registration.installing);
    };

    const checkOnOpen = async () => {
      if (twa) return;
      try { sessionStorage.removeItem(UPDATE_DISMISSED_KEY); } catch {}
      await checkDeploymentVersion();
      await checkForUpdate();
    };

    void checkOnOpen();
    return () => {
      cancelled = true;
      observedWorker = null;
      window.removeEventListener("hadir:sw-update-available", onServiceWorkerUpdateAvailable);
    };
  }, []);

  useEffect(() => {
    const onControllerChange = () => {
      const versionToRemember = pendingBuildVersionRef.current || detectedBuildVersionRef.current;
      if (versionToRemember) {
        try { localStorage.setItem(UPDATE_BUILD_VERSION_KEY, versionToRemember); } catch {}
      }
      setUpdating(false);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const dismissInstall = () => { try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, PWA_INSTALL_VERSION); } catch {} setInstallVisible(false); setManualInstallVisible(false); };
  const install = async () => { if (!installEvent) return; const currentEvent = installEvent; setInstallEvent(null); setInstallVisible(false); await currentEvent.prompt(); const choice = await currentEvent.userChoice; if (choice.outcome === "dismissed") { try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, PWA_INSTALL_VERSION); } catch {} } };

  const update = async () => {
    if (isAndroidTwa() || !isStandalone() || updating) return;
    setUpdating(true);
    setUpdateError("");
    try {
      const base = import.meta.env.BASE_URL || "/";
      const baseUrl = new URL(base, window.location.origin);
      const versionUrl = new URL("build-version.json", baseUrl);
      versionUrl.searchParams.set("check", String(Date.now()));
      const versionResponse = await fetch(versionUrl.toString(), { cache: "no-store", credentials: "same-origin" });
      if (!versionResponse.ok) throw new Error("تعذر الوصول إلى ملف إصدار النشر (build-version.json). تحقق من اتصال الإنترنت.");
      const versionData = await versionResponse.json().catch(() => null) as { commitSha?: unknown } | null;
      const buildVersion = typeof versionData?.commitSha === "string" ? versionData.commitSha.trim() : "";
      if (!buildVersion) throw new Error("ملف إصدار النشر لا يحتوي على رقم إصدار صالح.");
      detectedBuildVersionRef.current = buildVersion;
      pendingBuildVersionRef.current = buildVersion;

      const swUrl = new URL("sw.js", baseUrl);
      const registration = await navigator.serviceWorker.register(swUrl.toString(), { scope: baseUrl.pathname, updateViaCache: "none" });

      const applyWaitingWorker = (worker: ServiceWorker | null) => {
        if (!worker) return false;
        worker.postMessage({ type: "SKIP_WAITING" });
        return true;
      };

      if (applyWaitingWorker(registration.waiting)) return;

      const installedWorkerPromise = new Promise<ServiceWorker | null>(resolve => {
        let settled = false;
        let worker: ServiceWorker | null = null;
        const finish = (value: ServiceWorker | null) => {
          if (settled) return;
          settled = true;
          if (worker) worker.removeEventListener("statechange", onStateChange);
          registration.removeEventListener("updatefound", onUpdateFound);
          resolve(value);
        };
        const onStateChange = () => {
          if (!worker) return;
          if (worker.state === "installed") finish(worker);
          else if (worker.state === "redundant") finish(null);
        };
        const watchWorker = (candidate: ServiceWorker | null) => {
          if (!candidate || worker === candidate) return;
          worker = candidate;
          worker.addEventListener("statechange", onStateChange);
          onStateChange();
        };
        const onUpdateFound = () => watchWorker(registration.installing);
        registration.addEventListener("updatefound", onUpdateFound);
        watchWorker(registration.installing);
        window.setTimeout(() => finish(null), 20000);
      });

      await registration.update();

      if (applyWaitingWorker(registration.waiting)) return;

      const installedWorker = await installedWorkerPromise;
      if (installedWorker) {
        installedWorker.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      setUpdating(false);
      setUpdateError(`لم يصل Service Worker الجديد إلى حالة التثبيت بعد 20 ثانية. الإصدار المطلوب: ${buildVersion.slice(0, 12)}…`);
    } catch (error) {
      setUpdating(false);
      const message = error instanceof Error && error.message ? error.message : "حدث خطأ غير معروف أثناء تثبيت Service Worker الجديد.";
      setUpdateError(message);
    }
  };

  const dismissUpdate = () => { try { sessionStorage.setItem(UPDATE_DISMISSED_KEY, "1"); } catch {} setUpdateVisible(false); setUpdateError(""); };

  if (offline) return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-xl">📡</div><div className="min-w-0 flex-1"><p className="font-bold">أنت غير متصل بالإنترنت</p><p className="mt-0.5 text-xs text-muted-foreground">تم الحفاظ على جلسة الدخول. سيُستأنف الاتصال تلقائيًا عند عودته.</p></div></div></div>;
  if (updateVisible && standalone && !isAndroidTwa()) return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">✨</div><div className="min-w-0 flex-1"><p className="font-bold">تحديث جديد لحاضر متاح</p><p className="mt-1 text-xs leading-5 text-muted-foreground">سيتم تحديث واجهة التطبيق بأمان دون حذف بياناتك المحلية أو جلسة تسجيل الدخول.</p>{updateError && <p className="mt-2 text-xs leading-5 text-destructive">{updateError}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={update} disabled={updating} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{updating ? "جارٍ التحديث…" : "تحديث الآن"}</button><button type="button" onClick={dismissUpdate} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">لاحقًا</button></div></div><button type="button" aria-label="إغلاق" onClick={dismissUpdate} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  if (installVisible && installEvent) return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl">📱</div><div className="min-w-0 flex-1"><p className="font-bold">ثبّت حاضر كتطبيق</p><p className="mt-1 text-xs leading-5 text-muted-foreground">هذا هو تثبيت PWA الحقيقي، وليس اختصارًا عاديًا. سيعمل حاضر بواجهة مستقلة عن المتصفح ويحافظ على جلسة الحساب.</p><div className="mt-3 flex gap-2"><button type="button" onClick={install} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">تثبيت الآن</button><button type="button" onClick={dismissInstall} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">ليس الآن</button></div></div><button type="button" aria-label="إغلاق" onClick={dismissInstall} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  if (manualInstallVisible && isAndroid() && !installEvent) return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl">📲</div><div className="min-w-0 flex-1"><p className="font-bold">تثبيت حاضر كتطبيق</p><p className="mt-1 text-xs leading-5 text-muted-foreground">إذا لم يظهر زر التثبيت التلقائي، افتح قائمة Chrome ⋮ ثم اختر «تثبيت التطبيق» أو «Install app». لا تستخدم «إضافة إلى الشاشة الرئيسية» لأنها قد تنشئ اختصارًا فقط.</p><button type="button" onClick={dismissInstall} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-medium">فهمت</button></div><button type="button" aria-label="إغلاق" onClick={dismissInstall} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  if (manualInstallVisible && isIos() && isMobile()) return <div dir="rtl" className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-2xl border border-primary/25 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl">📲</div><div className="min-w-0 flex-1"><p className="font-bold">أضف حاضر إلى الشاشة الرئيسية</p><p className="mt-1 text-xs leading-5 text-muted-foreground">على iPhone أو iPad: افتح قائمة المشاركة في Safari ثم اختر «إضافة إلى الشاشة الرئيسية». هذه هي طريقة تثبيت PWA الرسمية على أجهزة Apple.</p><button type="button" onClick={dismissInstall} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-medium">فهمت</button></div><button type="button" aria-label="إغلاق" onClick={dismissInstall} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">✕</button></div></div>;
  return null;
}