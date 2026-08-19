import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const session = currentManager();

  if (!session || !session.role) {
    return <Navigate to="/manager/login" replace />;
  }

  if (!["owner", "manager", "supervisor"].includes(session.role)) {
    return <Navigate to="/manager/login" replace />;
  }

  return <>{children}</>;
}
