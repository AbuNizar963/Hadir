import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";

export type ManagerRole = "owner" | "manager" | "supervisor";

export default function RequireManagerRole({
  roles,
  children,
}: {
  roles: ManagerRole[];
  children: React.ReactNode;
}) {
  const session = currentManager();
  const role = session?.role as ManagerRole | undefined;

  if (!session || !role) {
    return <Navigate to="/manager/login" replace />;
  }

  if (!roles.includes(role)) {
    return <Navigate to="/manager" replace />;
  }

  return <>{children}</>;
}
