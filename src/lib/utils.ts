import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Normalize Arabic-Indic and Eastern Arabic-Indic digits to Western Arabic digits (0-9). */
export function normalizeDigits(value: string): string {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return normalizeDigits(date.toLocaleString("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZone: "Asia/Damascus",
  }));
}

export function formatTime(iso: string): string {
  return normalizeDigits(new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Damascus",
  }));
}

export function formatDate(iso: string): string {
  return normalizeDigits(new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Damascus",
  }));
}

export function formatNumber(value: number): string {
  return normalizeDigits(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value));
}

/** Return the application's official calendar date in Damascus time. */
export function todayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const min = safe % 60;
  return `${formatNumber(hours)} س ${formatNumber(min)} د`;
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
