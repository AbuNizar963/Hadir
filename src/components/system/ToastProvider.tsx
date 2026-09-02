import { CheckCircle2, CircleAlert, Info, LoaderCircle, XCircle } from "lucide-react";
import { Toaster, toast as sonnerToast } from "@/components/ui/sonner";
import "./toast.css";

const defaults = { position: "top-center" as const, richColors: true, closeButton: true, dir: "rtl" as const, visibleToasts: 4 };
const TOAST_DURATION = 1500;

export function ToastProvider() {
  return <Toaster {...defaults} toastOptions={{ duration: TOAST_DURATION }} />;
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
  success: (message: string, description?: string) => sonnerToast.success(message, { ...options, description, duration: TOAST_DURATION, icon: <CheckCircle2 aria-hidden="true" /> }),
  error: (message: string, description?: string) => sonnerToast.error(message, { ...options, description, duration: TOAST_DURATION, icon: <XCircle aria-hidden="true" /> }),
  warning: (message: string, description?: string) => sonnerToast.warning(message, { ...options, description, duration: TOAST_DURATION, icon: <CircleAlert aria-hidden="true" /> }),
  info: (message: string, description?: string) => sonnerToast.info(message, { ...options, description, duration: TOAST_DURATION, icon: <Info aria-hidden="true" /> }),
  loading: (message: string, description?: string) => sonnerToast.loading(message, { ...options, description, duration: Infinity, icon: <LoaderCircle className="animate-spin" aria-hidden="true" /> }),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
