import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { seedIfEmpty } from "@/lib/storage";
import { installGlobalDiagnostics, recordDiagnostic } from "@/lib/systemDiagnostics";

seedIfEmpty();
installGlobalDiagnostics();

window.addEventListener("unhandledrejection", (event) => {
  // Keep a compact application-level marker in addition to the global recorder.
  recordDiagnostic("error", "APP_UNHANDLED_REJECTION", "حدث خطأ غير معالج في التطبيق.", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
