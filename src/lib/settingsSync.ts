import { getBackendSettings, backendEnabled } from "@/lib/backend";
import type { Settings } from "@/types";

type SettingsListener = (settings: Settings) => void;
const listeners: Set<SettingsListener> = new Set();

export function subscribeToSettings(listener: SettingsListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function syncSettings() {
  if (!backendEnabled) return;
  try {
    const settings = await getBackendSettings();
    notifySettingsChanged(settings);
  } catch (error) {
    console.warn("Settings sync error:", error);
  }
}

function notifySettingsChanged(settings: Settings) {
  listeners.forEach(listener => {
    try {
      listener(settings);
    } catch (error) {
      console.error("Settings listener error:", error);
    }
  });
}

export function initializeSettingsSync() {
  if (typeof window === "undefined") return () => {};
  
  // Initial sync
  syncSettings().catch(error => console.warn("Initial settings sync failed:", error));
  
  // Sync every 60 seconds
  const intervalId = window.setInterval(() => {
    syncSettings().catch(error => console.warn("Periodic settings sync failed:", error));
  }, 60000);
  
  return () => window.clearInterval(intervalId);
}
