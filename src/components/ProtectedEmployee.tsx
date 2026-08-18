import { Navigate } from "react-router-dom";
import { currentSession } from "@/lib/auth";

export default function ProtectedEmployee({ children }: { children: React.ReactNode }) {
  const s = currentSession();
  if (!s) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
