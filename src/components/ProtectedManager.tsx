import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { currentManager } from "@/lib/auth";
import { backendMe, bootstrapBackend, backendEnabled } from "@/lib/backend";
import { setManagerSession } from "@/lib/storage";

export default function ProtectedManager({ children }: { children: React.ReactNode }) {
  const session=currentManager();
  const [checking,setChecking]=useState(backendEnabled);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!backendEnabled){setChecking(false);return}
    let alive=true;
    const run=async()=>{
      try{
        if(session){
          const me=await backendMe();
          if(me.user?.role){if(alive)setChecking(false);return}
        }
      }catch{}
      try{
        const b=await bootstrapBackend();
        if(alive){setManagerSession({loginAt:new Date().toISOString(),name:"إعداد النظام",role:"owner",jobNumber:"",accountId:"bootstrap"});setFailed(false);setChecking(false)}
        return b;
      }catch{
        if(alive){setManagerSession(null);setFailed(true);setChecking(false)}
      }
    };
    void run();
    return()=>{alive=false};
  },[]);
  if(checking)return <div className="min-h-screen flex items-center justify-center text-sm">جاري التحقق من اتصال حاضر بالخادم…</div>;
  const active=currentManager();
  if(failed || !active || !active.role || !["owner","manager","supervisor"].includes(active.role))return <Navigate to="/manager/login" replace />;
  return <>{children}</>;
}
