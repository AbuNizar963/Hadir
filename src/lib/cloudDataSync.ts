import { subscribeD1View, getD1View } from "@/lib/d1View";
import { syncReportData } from "@/lib/reportSync";

export async function hydrateLocalData() {
  await syncReportData();
}

export async function initializeDataSync() {
  if (typeof window === "undefined") return;
  
  // Initial sync
  await syncReportData();
  
  // Periodic sync every 30 seconds
  const intervalId = window.setInterval(() => {
    syncReportData().catch(error => console.warn("Periodic sync failed:", error));
  }, 30000);
  
  // Listen for visibility changes to sync when tab becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      syncReportData().catch(error => console.warn("Visibility sync failed:", error));
    }
  };
  
  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  // Cleanup function
  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

export function useD1ViewData() {
  return getD1View();
}
