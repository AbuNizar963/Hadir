export type NotificationSeverity = "info" | "success" | "warning" | "danger";
export type ViolationType = "late" | "early-checkout" | "absence" | "escape" | "device" | "location" | "other";
export type ViolationStatus = "open" | "accepted" | "rejected" | "resolved";
export type LeaveType = "annual" | "sick" | "permission" | "unpaid" | "other";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type TaskStatus = "todo" | "in-progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface LiveNotification { id: string; recipientId: string; type: string; title: string; body: string; severity: NotificationSeverity; readAt?: string | null; createdAt: string; }
export interface Violation { id: string; employeeId: string; type: ViolationType; severity: NotificationSeverity; occurredAt: string; minutes: number; reason?: string | null; status: ViolationStatus; reviewedBy?: string | null; reviewedAt?: string | null; createdAt: string; }
export interface LeaveRequest { id: string; employeeId: string; type: LeaveType; startDate: string; endDate: string; reason?: string | null; status: ApprovalStatus; reviewerId?: string | null; reviewedAt?: string | null; createdAt: string; }
export interface WorkforceTask { id: string; title: string; description?: string | null; assigneeId?: string | null; createdBy: string; status: TaskStatus; priority: TaskPriority; dueAt?: string | null; completedAt?: string | null; createdAt: string; updatedAt: string; }
export interface PerformanceReview { id: string; employeeId: string; periodStart: string; periodEnd: string; attendanceScore: number; punctualityScore: number; reliabilityScore: number; overallScore: number; notes?: string | null; reviewerId?: string | null; createdAt: string; }
export interface PayrollEntry { id: string; employeeId: string; periodStart: string; periodEnd: string; regularMinutes: number; overtimeMinutes: number; lateMinutes: number; absenceMinutes: number; adjustmentAmount: number; status: "draft" | "approved" | "locked"; approvedBy?: string | null; approvedAt?: string | null; createdAt: string; }
export interface AnomalyEvent { id: string; employeeId?: string | null; type: string; score: number; evidence?: string | null; status: "new" | "reviewing" | "resolved" | "dismissed"; detectedAt: string; resolvedAt?: string | null; }
export interface AIInsight { id: string; scope: "dashboard" | "employee" | "team" | "attendance"; scopeId?: string | null; kind: string; title: string; summary: string; evidence?: string | null; confidence?: number | null; createdAt: string; expiresAt?: string | null; }
export interface PushSubscriptionRecord { id: string; userId: string; endpoint: string; p256dh: string; auth: string; createdAt: string; lastSeenAt: string; }
