import { backendEnabled, getBackendAttendance, getBackendRequests, getBackendAudit } from "@/lib/backend";

export async function hydrateLocalData(){
  if(!backendEnabled||typeof window==="undefined")return;
  try{const [attendance,requests,audit]=await Promise.all([getBackendAttendance(2000),getBackendRequests(),getBackendAudit(2000)]);localStorage.setItem("hadir.attendance",JSON.stringify(attendance));localStorage.setItem("hadir.requests",JSON.stringify(requests));localStorage.setItem("hadir.audit",JSON.stringify(audit));window.dispatchEvent(new Event("hadir:cloud-data-changed"));}catch(error){console.warn("Hadir cloud data hydration deferred:",error)}
}
