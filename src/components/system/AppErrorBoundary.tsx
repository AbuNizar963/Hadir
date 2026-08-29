import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordDiagnostic } from "@/lib/systemDiagnostics";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string; recovering: boolean };

const RECOVERY_KEY = "hadir.pwa.transient-recovery-at";
const RECOVERY_COOLDOWN_MS = 60_000;

function isTransientConnectionError(message: string): boolean {
  return message.includes("تعذر الاتصال بخادم حاضر") ||
    message.includes("انتهت مهلة الاتصال بخادم حاضر") ||
    message.includes("Failed to fetch") ||
    message.includes("Load failed") ||
    message.includes("NetworkError");
}

function canAutoRecover(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = Number(sessionStorage.getItem(RECOVERY_KEY) || "0");
    return !previous || Date.now() - previous >= RECOVERY_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markAutoRecovery(): void {
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", recovering: false };
  private recoveryTimer: number | undefined;
  private recoveryCleanup: (() => void) | undefined;

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "حدث خطأ غير متوقع.",
      recovering: false,
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    recordDiagnostic("error", "APP_RENDER_ERROR", "تعذر عرض جزء من التطبيق.", {
      error,
      componentStack: info.componentStack,
    });

    const message = error instanceof Error ? error.message : "";
    if (!isTransientConnectionError(message) || !canAutoRecover()) return;
    this.installRecoveryListeners();
    this.scheduleRecoveryIfOnline();
  }

  componentWillUnmount() {
    this.clearRecovery();
  }

  installRecoveryListeners = () => {
    if (typeof window === "undefined" || this.recoveryCleanup) return;
    const recover = () => this.scheduleRecoveryIfOnline();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", handleVisibility);
    this.recoveryCleanup = () => {
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  };

  scheduleRecoveryIfOnline = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    if (!navigator.onLine || document.visibilityState !== "visible") return;
    if (!canAutoRecover()) return;
    if (this.recoveryTimer !== undefined) return;

    this.setState({ recovering: true });
    this.recoveryTimer = window.setTimeout(() => {
      this.recoveryTimer = undefined;
      markAutoRecovery();
      window.location.reload();
    }, 1200);
  };

  clearRecovery = () => {
    if (this.recoveryTimer !== undefined && typeof window !== "undefined") {
      window.clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    this.recoveryCleanup?.();
    this.recoveryCleanup = undefined;
  };

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main dir="rtl" className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <section className="hud-card w-full max-w-lg p-6 text-center space-y-5" role="alert" aria-live="assertive">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black">تعذر عرض هذه الصفحة</h1>
            <p className="text-sm text-muted-foreground">
              حدث انقطاع مؤقت في الاتصال. بياناتك محفوظة، وسيحاول التطبيق استعادة الاتصال تلقائيًا عند العودة من الخلفية.
            </p>
            {this.state.recovering && (
              <p className="text-xs font-bold text-muted-foreground">جاري استعادة التطبيق…</p>
            )}
            {this.state.message && <p className="text-xs text-muted-foreground break-words">{this.state.message}</p>}
          </div>
          <Button onClick={this.handleReload} className="w-full sm:w-auto">
            <RefreshCw className="ml-2 h-4 w-4" aria-hidden="true" />
            إعادة تحميل التطبيق
          </Button>
        </section>
      </main>
    );
  }
}
