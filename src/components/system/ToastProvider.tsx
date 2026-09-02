import { CheckCircle2, CircleAlert, Info, LoaderCircle, XCircle } from "lucide-react";
import { Toaster, toast as sonnerToast } from "@/components/ui/sonner";

const defaults = { position: "top-center" as const, richColors: true, closeButton: true, dir: "rtl" as const, visibleToasts: 4 };

export function ToastProvider() {
  return <Toaster {...defaults} toastOptions={{ duration: 4500 }} />;
}

export function userFacingError(error: unknown, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.") {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch|networkerror|load failed|تعذر الاتصال بخادم/i.test(message)) return "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.";
  if (/abort|timeout|انتهت مهلة/i.test(message)) return "انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.";
  if (/^TypeError:|^ReferenceError:|^SyntaxError:/i.test(message)) return fallback;
  return message.length > 220 ? fallback : message;
}

const options = { position: "top-center" as const };

export const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { ...options, description, icon: <CheckCircle2 aria-hidden="true" /> }),
  error: (message: string, description?: string) => sonnerToast.error(message, { ...options, description, duration: 6500, icon: <XCircle aria-hidden="true" /> }),
  warning: (message: string, description?: string) => sonnerToast.warning(message, { ...options, description, duration: 5500, icon: <CircleAlert aria-hidden="true" /> }),
  info: (message: string, description?: string) => sonnerToast.info(message, { ...options, description, icon: <Info aria-hidden="true" /> }),
  loading: (message: string, description?: string) => sonnerToast.loading(message, { ...options, description, duration: Infinity, icon: <LoaderCircle className="animate-spin" aria-hidden="true" /> }),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
