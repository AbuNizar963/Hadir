import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordDiagnostic } from "@/lib/systemDiagnostics";

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "حدث خطأ غير متوقع.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    recordDiagnostic("error", "APP_RENDER_ERROR", "تعذر عرض جزء من التطبيق.", {
      error,
      componentStack: info.componentStack,
    });
  }

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
            <p className="text-sm text-muted-foreground">حدث خطأ غير متوقع. بياناتك محفوظة، ويمكنك إعادة تحميل الصفحة للمتابعة.</p>
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
