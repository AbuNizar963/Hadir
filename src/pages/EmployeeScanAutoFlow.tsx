import { useEffect, useState } from "react";
import Brand from "@/components/Brand";
import EmployeeScan from "@/pages/EmployeeScan";

export default function EmployeeScanAutoFlow() {
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let locationStarted = false;
    let cameraStarted = false;
    let submitted = false;

    const tick = () => {
      if (cancelled) return;
      if (!locationStarted) {
        const locationButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent?.includes("تحديد موقعي الحالي"));
        if (locationButton && !locationButton.disabled) { locationStarted = true; locationButton.click(); }
      }
      if (!cameraStarted) {
        const cameraButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent?.includes("فتح ماسح QR"));
        if (cameraButton && !cameraButton.disabled) { cameraStarted = true; cameraButton.click(); }
      }
      if (!submitted) {
        const submitButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent?.includes("تأكيد تسجيل الحضور") || button.textContent?.includes("تأكيد تسجيل الانصراف"));
        if (submitButton && !submitButton.disabled) { submitted = true; submitButton.click(); }
      }
      window.setTimeout(tick, 350);
    };

    const observer = new MutationObserver(() => {
      if ((document.body.textContent || "").includes("تمت العملية بنجاح")) setSuccess(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    tick();
    return () => { cancelled = true; observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      window.location.assign("/employee");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  return (
    <>
      <EmployeeScan />
      {success && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-background/90 backdrop-blur-md px-4" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-3xl border border-primary/30 bg-card shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="mx-auto mb-6 h-24 w-24 rounded-3xl border border-primary/30 bg-primary/10 grid place-items-center text-primary shadow-[0_0_45px_hsl(var(--primary)/.18)]"><span className="text-5xl font-black leading-none">✓</span></div>
            <div className="mb-5 flex justify-center"><Brand /></div>
            <h2 className="text-2xl font-black text-primary">تمت العملية بنجاح</h2>
            <p className="mt-2 text-sm text-muted-foreground">تم تأكيد تسجيل الحضور أو الانصراف بنجاح.</p>
            <p className="mt-4 text-xs text-muted-foreground">سيتم إعادتك إلى الواجهة الرئيسية خلال 3 ثوانٍ...</p>
          </div>
        </div>
      )}
    </>
  );
}
