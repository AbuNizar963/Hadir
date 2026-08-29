import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordDiagnostic } from "@/lib/systemDiagnostics";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string; recovering: boolean };

function isRecoverableRuntimeError(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes("تعذر الاتصال بخادم حاضر") || value.includes("انتهت مهلة الاتصال بخادم حاضر") || value.includes("failed to fetch") || value.includes("load failed") || value.includes("networkerror") || value.includes("filter is not a function");
}

function browserIsOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", recovering: false };
  private recoveryTimer: number | undefined;
  private recoveryCleanup: (() => void) | undefined;
  private recoveryInProgress = false;

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : "حدث خطأ غير متوقع.", recovering: false };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    recordDiagnostic("error", "APP_RENDER_ERROR", "تعذر عرض جزء من التطبيق.", { error, componentStack: info.componentStack });
    const message = error instanceof Error ? error.message : "";
    if (!isRecoverableRuntimeError(message)) return;
    this.installRecoveryListeners();
    this.scheduleRecovery();
  }

  componentWillUnmount() { this.clearRecovery(); }

  installRecoveryListeners = () => {
    if (typeof window === "undefined" || this.recoveryCleanup) return;
    const recover = () => { if (browserIsOnline()) this.scheduleRecovery(); };
    const handleVisibility = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", handleVisibility);
    this.recoveryCleanup = () => {
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  };

  scheduleRecovery = () => {
    if (typeof window === "undefined" || this.recoveryTimer !== undefined || this.recoveryInProgress) return;
    if (!browserIsOnline() || document.visibilityState !== "visible") return;
    this.setState({ recovering: true });
    this.recoveryTimer = window.setTimeout(() => {
      this.recoveryTimer = undefined;
      this.recoveryInProgress = true;
      this.setState({ hasError: false, message: "", recovering: false }, () => {
        window.setTimeout(() => { this.recoveryInProgress = false; }, 500);
      });
    }, 700);
  };

  clearRecovery = () => {
    if (this.recoveryTimer !== undefined && typeof window !== "undefined") {
      window.clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    this.recoveryCleanup?.();
    this.recoveryCleanup = undefined;
    this.recoveryInProgress = false;
  };

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;
    const recoverable = isRecoverableRuntimeError(this.state.message);
    return (
      <main dir="rtl" className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <section className="hud-card w-full max-w-lg p-6 text-center space-y-5" role="alert" aria-live="assertive">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            {recoverable ? <WifiOff className="h-7 w-7" aria-hidden="true" /> : <AlertTriangle className="h-7 w-7" aria-hidden="true" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black">تعذر عرض هذه الصفحة</h1>
            <p className="text-sm text-muted-foreground">{recoverable ? "حدث انقطاع مؤقت في الاتصال أو أثناء استعادة البيانات. سيحاول التطبيق استعادة الصفحة دون تسجيل خروجك." : "حدث خطأ غير متوقع. بياناتك محفوظة، ويمكنك إعادة تحميل الصفحة للمتابعة."}</p>
            {this.state.recovering && <p className="text-xs font-bold text-muted-foreground">جاري استعادة التطبيق والاتصال بالخادم…</p>}
            {!this.state.recovering && this.state.message && <p className="text-xs text-muted-foreground break-words">{this.state.message}</p>}
          </div>
          <Button onClick={this.handleReload} className="w-full sm:w-auto"><RefreshCw className="ml-2 h-4 w-4" aria-hidden="true" />إعادة تحميل التطبيق</Button>
        </section>
      </main>
    );
  }
}
