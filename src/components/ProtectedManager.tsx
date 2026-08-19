import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";
import { bootstrapBackend, backendEnabled } from "@/lib/backend";
import { setManagerSession } from "@/lib/storage";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const session = currentManager();
  const [bootstrapping,setBootstrapping]=useState(!session && backendEnabled);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(session || !backendEnabled)return;
    let alive=true;
    bootstrapBackend().then(()=>{if(!alive)return;setManagerSession({loginAt:new Date().toISOString(),name:"إعداد النظام",role:"owner",jobNumber:"",accountId:"bootstrap"});setBootstrapping(false);}).catch(()=>{if(!alive)return;setFailed(true);setBootstrapping(false);});
    return()=>{alive=false};
  },[session]);
  if(bootstrapping)return <div className="min-h-screen flex items-center justify-center text-sm">جاري فتح لوحة الإدارة لأول إعداد…</div>;
  const active=currentManager();
  if(failed || !active || !active.role || !["owner","manager","supervisor"].includes(active.role))return <Navigate to="/manager/login" replace />;
  return <>{children}</>;
}
