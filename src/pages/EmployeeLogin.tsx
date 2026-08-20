import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "@/components/Brand";
import { backendEnabled, backendEmployeeLogin } from "@/lib/backend";
import { setSession } from "@/lib/storage";
import type { Employee } from "@/types";

export default function EmployeeLogin(){
 const navigate=useNavigate();
 const [jobNumber,setJobNumber]=useState("");
 const [pin,setPin]=useState("");
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(loading)return;
  setLoading(true);setError(null);
  const number=jobNumber.trim();
  const code=pin.trim();
  try{
   if(!backendEnabled) throw new Error("خدمة تسجيل دخول الموظفين غير مفعلة. تحقق من إعداد Cloudflare Worker.");
   const emp=await backendEmployeeLogin(number,code) as Employee;
   setSession({employeeId:emp.id,jobNumber:emp.jobNumber,name:emp.name,loginAt:new Date().toISOString(),role:emp.role});
   window.dispatchEvent(new Event("hadir:session-changed"));
   navigate("/employee",{replace:true});
  }catch(err){
   setError(err instanceof Error?err.message:"تعذر تسجيل الدخول");
  }finally{setLoading(false);}
 };
 return <div className="min-h-screen flex flex-col"><header className="p-5"><Brand/></header><main className="flex-1 grid place-items-center px-5 pb-10"><div className="w-full max-w-md hud-card p-7"><div className="text-xs mono text-muted-foreground">EMPLOYEE · حاضِر</div><h1 className="text-2xl font-extrabold mt-1">دخول الموظفين</h1><p className="text-sm text-muted-foreground mt-1">أدخل الرقم الوظيفي ورمز الدخول الخاص بك.</p><form onSubmit={submit} className="mt-6 space-y-4"><div><label className="block text-sm text-semibold mb-1.5">الرقم الوظيفي</label><input className="input w-full" value={jobNumber} onChange={e=>setJobNumber(e.target.value)} required/></div><div><label className="block text-sm font-semibold mb-1.5">رمز الدخول</label><input className="input w-full" type="password" value={pin} onChange={e=>setPin(e.target.value)} required/></div>{error&&<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">{error}</div>}<button className="btn-primary w-full py-3" disabled={loading}>{loading?"جاري التحقق...":"دخول الموظف"}</button></form><div className="mt-5 text-xs text-center flex justify-between"><Link to="/">← العودة للرئيسية</Link><Link to="/manager/login">دخول الإدارة</Link></div></div></main></div>
}