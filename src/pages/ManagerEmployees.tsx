import { useState, useMemo, useRef } from "react";
import ManagerLayout from "@/components/layout/ManagerLayout";
import {
  getEmployees,
  saveEmployees,
  getAttendance,
  getSettings,
  forceCheckInByManager,
  getRequests,
  updateRequestStatus,
  EmployeeRequest,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee, EmployeeStatus, ScheduleType, UserRole } from "@/types";
import { addNotification } from "@/lib/notifications";

export default function ManageEmployees() {
  const [s] = useState(getSettings());
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [requests, setRequests] = useState<EmployeeRequest[]>(getRequests());

  const [name, setName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [pin, setPin] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("staff");
  const [locationId, setLocationId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("ADMIN");

  // حقول أوقات الدوام الخاصة بالموظف
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(15);

  const [rotationStartDate, setRotationStartDate] = useState("");
  const [rotationPreset, setRotationPreset] = useState<"4/4" | "3/3" | "2/2" | "custom">("4/4");
  const [rotationDaysOn, setRotationDaysOn] = useState<number>(4);
  const [rotationDaysOff, setRotationDaysOff] = useState<number>(4);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attendance = useMemo(() => getAttendance(), [employees]);

  const refreshRequests = () => {
    setRequests(getRequests());
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة صالح (JPG/PNG/WEBP).");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 500 كيلوبايت.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      setError(null);
    };
    reader.onerror = () => setError("تعذّر قراءة ملف الصورة.");
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setName("");
    setJobNumber("");
    setPin("");
    setDeviceLabel("");
    setAvatar(null);
    setRole("staff");
    setLocationId("");
    setScheduleType("ADMIN");
    setWorkStartTime("08:00");
    setWorkEndTime("16:00");
    setGracePeriodMinutes(15);
    setRotationStartDate("");
    setRotationPreset("4/4");
    setRotationDaysOn(4);
    setRotationDaysOff(4);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !jobNumber.trim()) return;

    if (employees.some((emp) => emp.jobNumber === jobNumber.trim())) {
      setError("الرقم الوظيفي مسجل مسبقاً لموظف آخر.");
      return;
    }

    if (scheduleType === "ROTATION" && !rotationStartDate) {
      setError("يرجى تحديد تاريخ بداية أول وردية للنظام التناوبي.");
      return;
    }

    if (scheduleType === "ROTATION") {
      if (rotationDaysOn <= 0) {
        setError("عدد أيام العمل يجب أن يكون على الأقل 1.");
        return;
      }
      if (rotationDaysOff < 0) {
        setError("عدد أيام الراحة لا يمكن أن يكون سالباً.");
        return;
      }
    }

    const effectivePin = pin.trim() || jobNumber.trim();

    const newEmp: Employee = {
      id: generateId(),
      name: name.trim(),
      jobNumber: jobNumber.trim(),
      pinHash: hash(effectivePin),
      status: "active",
      deviceId: null,
      deviceLabel: deviceLabel.trim() || null,
      createdAt: new Date().toISOString(),
      scheduleType,
      workStartTime,
      workEndTime,
      gracePeriodMinutes,
      rotationStartDate: scheduleType === "ROTATION" ? rotationStartDate : null,
      rotationDaysOn: scheduleType === "ROTATION" ? rotationDaysOn : undefined,
      rotationDaysOff: scheduleType === "ROTATION" ? rotationDaysOff : undefined,
      avatar,
      role,
      locationId: locationId || null,
      specialties: ["general"],
    };

    const updated = [newEmp, ...employees];
    setEmployees(updated);
    saveEmployees(updated);
    setSuccess(`تم إضافة الموظف "${newEmp.name}" بنجاح · كلمة المرور الافتراضية: ${effectivePin}`);
    resetForm();
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleDelete = (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الموظف؟ سيتم إلغاء توثيق جهازه تلقائياً.")) return;
    const updated = employees.filter((e) => e.id !== id);
    setEmployees(updated);
    saveEmployees(updated);
  };

  const handleResetDevice = (id: string) => {
    if (!confirm("هل تريد إعادة تعيين جهاز هذا الموظف؟ سيتمكن من تسجيل الدخول من جهاز جديد.")) return;
    const updated = employees.map((e) =>
      e.id === id ? { ...e, deviceId: null, deviceLabel: null } : e
    );
    setEmployees(updated);
    saveEmployees(updated);
  };

  const toggleStatus = (id: string) => {
    const updated = employees.map((e) => {
      if (e.id !== id) return e;
      const next: EmployeeStatus = e.status === "active" ? "suspended" : "active";
      return { ...e, status: next };
    });
    setEmployees(updated);
    saveEmployees(updated);
  };

  const handleRoleChange = (id: string, newRole: UserRole) => {
    const updated = employees.map((e) => (e.id === id ? { ...e, role: newRole } : e));
    setEmployees(updated);
    saveEmployees(updated);
  };

  // دالة التحضير اليدوي الفوري للموظف
  const handleForceCheckIn = (emp: Employee) => {
    const actionType = confirm(`اضغط "موافق" لتسجيل (حضور) الموظف ${emp.name}\nأو اضغط "إلغاء" لتسجيل (انصراف).`);
    const type = actionType ? "check-in" : "check-out";
    forceCheckInByManager(emp, type);

    // إرسال إشعار للموظف بالتحضير اليدوي
    addNotification({
      userId: emp.jobNumber,
      title: "تحديث حضور وانصراف",
      body: `قام المدير بتسجيل ${type === "check-in" ? "حضورك" : "انصرافك"} يدوياً.`,
      type: "info",
    });

    alert(`تم تسجيل ${type === "check-in" ? "حضور" : "انصراف"} الموظف ${emp.name} بنجاح يدوياً.`);
  };

  // التعامل مع موافقة/رفض طلبات الموظفين وإرسال إشعار للموظف
  const handleUpdateRequest = (req: EmployeeRequest, status: "approved" | "rejected") => {
    updateRequestStatus(req.id, status);
    refreshRequests();

    const isApproved = status === "approved";
    const reqTypeText =
      req.type === "permission"
        ? "استئذان الخروج المبكر"
        : req.type === "leave"
        ? "طلب الإجازة"
        : "طلب الانصراف المباشر";

    // إرسال إشعار فوري للموظف صاحبه الطلب
    addNotification({
      userId: req.jobNumber,
      title: isApproved ? "تمت الموافقة على طلبك" : "تم رفض طلبك",
      body: `تمت ${isApproved ? "الموافقة على" : "رفض"} ${reqTypeText}.`,
      type: isApproved ? "success" : "error",
    });
  };

  return (
    <ManagerLayout title="إدارة الموظفين والطلبات" subtitle="إضافة الموظفين، التحضير اليدوي والموافقة على الطلبات">
      <div className="space-y-6">

        {/* قسم طلبات الموظفين (استئذان / إجازة / انصراف) */}
        {requests.length > 0 && (
          <section className="hud-card p-4 sm:p-5 border-2 border-primary/30">
            <h2 className="text-sm font-bold mb-3 flex items-center justify-between">
              <span>📩 طلبات الاستئذان والإجازات المعلقة ({requests.filter(r => r.status === "pending").length})</span>
            </h2>
            <div className="space-y-2.5">
              {requests.map((req) => (
                <div key={req.id} className="p-3 rounded-xl bg-secondary/30 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">
                      {req.employeeName} <span className="text-xs text-muted-foreground mono">({req.jobNumber})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      الطلب: <strong className="text-foreground">
                        {req.type === "permission" ? "استئذان خروج مبكر" : req.type === "leave" ? "طلب إجازة" : "انصراف مباشر"}
                      </strong>
                      {req.reason && ` · السبب: ${req.reason}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleUpdateRequest(req, "approved")}
                          className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110"
                        >
                          موافقة
                        </button>
                        <button
                          onClick={() => handleUpdateRequest(req, "rejected")}
                          className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-bold rounded-lg hover:bg-destructive/20"
                        >
                          رفض
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${req.status === "approved" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                        {req.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* استمارة إضافة موظف جديد */}
        <form onSubmit={handleAdd} className="hud-card p-5 space-y-4">
          <div className="text-xs mono text-muted-foreground">ADD EMPLOYEE · إضافة موظف جديد</div>

          {error && <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg">{error}</div>}
          {success && <div className="p-3 text-xs bg-primary/10 text-primary rounded-lg">{success}</div>}

          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  className="h-16 w-16 rounded-full object-cover border-2 border-primary/50"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-secondary/50 border-2 border-dashed border-border grid place-items-center group-hover:border-primary transition">
                  <CameraIcon />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
            <div className="text-xs text-muted-foreground leading-relaxed flex-1">
              <div className="font-bold text-foreground text-sm">صورة الملف الشخصي</div>
              <div className="mt-0.5">اختياري · JPG/PNG · بحد أقصى 500 كيلوبايت</div>
              {avatar && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatar(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-1 text-destructive hover:brightness-125 font-semibold text-[11px]"
                >
                  إزالة الصورة
                </button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">اسم الموظف *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">الرقم الوظيفي *</label>
              <input className="input mono" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">رمز PIN (اختياري)</label>
              <input className="input mono" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="افتراضي: الرقم الوظيفي" />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">الدور / الصلاحية</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="staff">موظف (Staff)</option>
                <option value="supervisor">مشرف (Supervisor)</option>
                <option value="manager">مدير (Manager)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">موقع العمل المخصص</label>
              <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">الموقع الرئيسي (الافتراضي)</option>
                {s.locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">نوع الجدول / الدوام</label>
              <select className="input" value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ScheduleType)}>
                <option value="ADMIN">إداري (ثابت)</option>
                <option value="ROTATION">تناوبي (Rotation)</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-muted-foreground mb-1">وصف الجهاز (اختياري)</label>
              <input className="input" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} placeholder="مثال: هاتف العمل" />
            </div>
          </div>

          {/* قسم أوقات الدوام الخاصة بالموظف */}
          <div className="border-t border-border pt-4">
            <div className="text-xs font-bold text-muted-foreground mb-3">⏰ أوقات ومهلة الحضور الخاصة بالموظف</div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">وقت بداية الدوام</label>
                <input
                  type="time"
                  className="input mono"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">وقت نهاية الدوام</label>
                <input
                  type="time"
                  className="input mono"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">مهلة التأخير المقبولة (بالدقائق)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className="input mono"
                  value={gracePeriodMinutes}
                  onChange={(e) => setGracePeriodMinutes(+e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* خيارات النظام التناوبي عند اختياره */}
          {scheduleType === "ROTATION" && (
            <div className="border-t border-border pt-4 grid sm:grid-cols-2 md:grid-cols-4 gap-3 bg-secondary/20 p-3 rounded-lg">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">تاريخ بداية التناوب *</label>
                <input type="date" className="input mono text-xs" value={rotationStartDate} onChange={(e) => setRotationStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">نمط الوردية</label>
                <select
                  className="input text-xs"
                  value={rotationPreset}
                  onChange={(e) => {
                    const v = e.target.value as "4/4" | "3/3" | "2/2" | "custom";
                    setRotationPreset(v);
                    if (v === "4/4") { setRotationDaysOn(4); setRotationDaysOff(4); }
                    if (v === "3/3") { setRotationDaysOn(3); setRotationDaysOff(3); }
                    if (v === "2/2") { setRotationDaysOn(2); setRotationDaysOff(2); }
                  }}
                >
                  <option value="4/4">4/4</option>
                  <option value="3/3">3/3</option>
                  <option value="2/2">2/2</option>
                  <option value="custom">مخصص</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">أيام العمل</label>
                <input type="number" min={1} className="input mono text-xs" value={rotationDaysOn} onChange={(e) => setRotationDaysOn(+e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">أيام الراحة</label>
                <input type="number" min={0} className="input mono text-xs" value={rotationDaysOff} onChange={(e) => setRotationDaysOff(+e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={resetForm} className="btn-secondary text-xs">إلغاء</button>
            <button type="submit" className="btn-primary text-xs">+ إضافة الموظف</button>
          </div>
        </form>

        {/* قائمة الموظفين */}
        <section className="hud-card p-4 sm:p-5">
          <h2 className="text-sm font-bold mb-4">
            قائمة الموظفين والمشرفين الحاليين ({employees.length})
          </h2>
          <div className="space-y-3">
            {employees.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                لا يوجد موظفون مسجلون حالياً.
              </div>
            ) : (
              employees.map((emp) => {
                const totalLogs = attendance.filter((r) => r.employeeId === emp.id).length;
                const assignedLoc = s.locations?.find((l) => l.id === emp.locationId);

                return (
                  <div
                    key={emp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0 gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {emp.avatar ? (
                        <img
                          src={emp.avatar}
                          alt={emp.name}
                          className="h-11 w-11 rounded-full object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-primary/15 border border-border grid place-items-center shrink-0">
                          <span className="text-primary font-bold text-sm">
                            {emp.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm flex flex-wrap items-center gap-1.5">
                          <span className="truncate">{emp.name}</span>
                          {emp.role === "supervisor" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold border border-purple-500/30">
                              مشرف
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              emp.scheduleType === "ROTATION"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-sky-500/10 text-sky-500"
                            }`}
                          >
                            {emp.scheduleType === "ROTATION"
                              ? `تناوبي ${emp.rotationDaysOn ?? 4}/${emp.rotationDaysOff ?? 4}`
                              : "إداري"}
                          </span>
                          {emp.status === "suspended" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                              موقوف
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                          <span>
                            رقم: <strong className="mono">{emp.jobNumber}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            الدوام:{" "}
                            <strong className="mono text-foreground">
                              {emp.workStartTime ?? "—"} → {emp.workEndTime ?? "—"}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            مهلة: <strong className="mono">{emp.gracePeriodMinutes ?? 0}د</strong>
                          </span>
                          <span>·</span>
                          <span>
                            الموقع:{" "}
                            <strong className="text-foreground">
                              {assignedLoc ? assignedLoc.name : "الرئيسي"}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            الجهاز:{" "}
                            <strong className={emp.deviceId ? "text-primary" : "text-muted-foreground"}>
                              {emp.deviceLabel || "غير مربوط"}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            العمليات: <strong className="mono">{totalLogs}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                      {/* زر التحضير اليدوي من قبل المدير */}
                      <button
                        onClick={() => handleForceCheckIn(emp)}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 font-bold transition"
                      >
                        ⚡ تحضير يدوي
                      </button>

                      <select
                        value={emp.role || "staff"}
                        onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-border bg-secondary/50 font-medium"
                      >
                        <option value="staff">موظف</option>
                        <option value="supervisor">مشرف</option>
                      </select>

                      <button
                        onClick={() => toggleStatus(emp.id)}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary font-medium transition"
                      >
                        {emp.status === "active" ? "إيقاف" : "تفعيل"}
                      </button>
                      <button
                        onClick={() => handleResetDevice(emp.id)}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary font-medium transition"
                      >
                        فك الجهاز
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </ManagerLayout>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
