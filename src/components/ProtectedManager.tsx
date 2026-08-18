import { Navigate } from "react-router-dom";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  // التحقق من حالة الدخول المخزنة في localStorage
  const isAuthenticated = localStorage.getItem("managerAuth") === "true";

  if (!isAuthenticated) {
    // إذا لم يكن المستخدم مسجل دخول → إعادة التوجيه لصفحة تسجيل الدخول
    return <Navigate to="/manager/login" replace />;
  }

  // إذا كان مسجل دخول → عرض المحتوى
  return <>{children}</>;
}
