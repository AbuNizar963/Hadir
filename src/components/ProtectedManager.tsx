import { Navigate } from "react-router-dom";
import { getManagerSession } from "@/lib/storage";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  // التحقق من حالة الدخول
  const authFlag = localStorage.getItem("managerAuth") === "true";
  
  // التحقق من الجلسة
  const session = getManagerSession() as any;

  // إذا لم يكن هناك علم الدخول أو لم تكن الجلسة موجودة
  if (!authFlag || !session) {
    // تنظيف المخلفات القديمة
    localStorage.removeItem("managerAuth");
    localStorage.removeItem("hadir.manager_session");
    // توجيه المستخدم لصفحة تسجيل الدخول
    return <Navigate to="/manager/login" replace />;
  }

  // تصحيح تلقائي سريع: إذا كانت الجلسة باسم AbuNizar ولكن الدور لم يُضبط كمالك لأي سبب، نقوم بتصحيحه طالما أن الـ authFlag صحيح
  if (session && (session.jobNumber === "AbuNizar" || session.role === "owner")) {
    if (session.role !== "owner") {
      session.role = "owner";
      localStorage.setItem("hadir.manager_session", JSON.stringify(session));
    }
  }

  // السماح بالدخول وعرض المحتوى المطلوب
  return <>{children}</>;
}
