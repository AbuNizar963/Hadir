import { Navigate } from "react-router-dom";
import { getManagerSession } from "@/lib/storage";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  // التحقق من حالة الدخول القديمة
  const authFlag = localStorage.getItem("managerAuth") === "true";
  
  // التحقق من الجلسة الجديدة التي تحتوي على دور المستخدم (مالك، مدير، مشرف)
  const session = getManagerSession();

  // إذا لم يكن هناك تسجيل دخول، أو كانت الجلسة قديمة ولا تحتوي على الدور
  if (!authFlag || !session) {
    // مسح أي بيانات دخول قديمة غير صالحة
    localStorage.removeItem("managerAuth");
    // توجيه المستخدم لصفحة تسجيل الدخول لإدخال البيانات الجديدة
    return <Navigate to="/manager/login" replace />;
  }

  // إذا كان مسجل دخول بشكل صحيح ويمتلك جلسة صالحة → عرض المحتوى
  return <>{children}</>;
}
