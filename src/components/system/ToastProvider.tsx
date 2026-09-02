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

export const toast = {
  success: (message: string, description?: string) => sonnerToast.success(message, { description }),
  error: (message: string, description?: string) => sonnerToast.error(message, { description, duration: 6500 }),
  warning: (message: string, description?: string) => sonnerToast.warning(message, { description, duration: 5500 }),
  info: (message: string, description?: string) => sonnerToast.info(message, { description }),
  loading: (message: string, description?: string) => sonnerToast.loading(message, { description }),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
