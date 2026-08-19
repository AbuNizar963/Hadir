import type { Employee } from "@/types";
import { backendEnabled, getBackendEmployees, createBackendEmployee, updateBackendEmployee, deleteBackendEmployee, resetBackendEmployeeDevice } from "@/lib/backend";

const KEY="hadir.employees";
let running=false;

function localRead():Employee[]{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as Employee[]:[];}catch{return[];}}
function localWrite(list:Employee[]){try{localStorage.setItem(KEY,JSON.stringify(list));window.dispatchEvent(new Event("hadir:employees-changed"));}catch{ /* local cache failure must not break the UI */ }}

const legacyPin=(value:string)=>/^[0-9a-f]+-[0-9a-f]+$/i.test(value);

export async function syncEmployeesToCloud(localEmployees?:Employee[]){
  if(!backendEnabled||running||typeof window==="undefined")return;
  running=true;
  try{
    const local=localEmployees||localRead();
    const remote=await getBackendEmployees();
    const byId=new Map(remote.map(e=>[e.id,e]));
    const byJob=new Map(remote.map(e=>[e.jobNumber,e]));
    const merged=[...remote];
    for(const employee of local){
      const existing=byId.get(employee.id)||byJob.get(employee.jobNumber);
      if(!existing){
        await createBackendEmployee({...employee,pinHash:employee.pinHash});
        merged.push(employee);
        continue;
      }
      const input:any={
        jobNumber:employee.jobNumber,name:employee.name,status:employee.status,deviceId:employee.deviceId,deviceLabel:employee.deviceLabel,
        scheduleType:employee.scheduleType,rotationStartDate:employee.rotationStartDate,workStartTime:employee.workStartTime,workEndTime:employee.workEndTime,
        gracePeriodMinutes:employee.gracePeriodMinutes,role:employee.role,locationId:employee.locationId,rotationDaysOn:employee.rotationDaysOn,rotationDaysOff:employee.rotationDaysOff,
        specialties:employee.specialties,workDays:employee.workDays,avatar:employee.avatar,
      };
      if(legacyPin(employee.pinHash))input.pinHash=employee.pinHash;
      await updateBackendEmployee(existing.id,input);
      const index=merged.findIndex(e=>e.id===existing.id); if(index>=0)merged[index]={...existing,...employee,id:existing.id};
    }
    localWrite(merged);
  }catch(error){console.warn("Hadir cloud sync deferred:",error)}finally{running=false;}
}

export async function pullEmployeesFromCloud(){
  if(!backendEnabled||typeof window==="undefined")return;
  try{
    const remote=await getBackendEmployees();
    const local=localRead();
    const localById=new Map(local.map(e=>[e.id,e]));
    const localByJob=new Map(local.map(e=>[e.jobNumber,e]));
    const merged=remote.map(remoteEmployee=>{
      const cached=localById.get(remoteEmployee.id)||localByJob.get(remoteEmployee.jobNumber);
      return cached?{...remoteEmployee,pinHash:cached.pinHash}:remoteEmployee;
    });
    localWrite(merged);
  }catch(error){console.warn("Hadir cloud pull deferred:",error)}
}

export async function removeEmployeeFromCloud(id:string){if(!backendEnabled)return;try{await deleteBackendEmployee(id)}catch(error){console.warn("Cloud delete deferred:",error)}}
export async function resetEmployeeDeviceInCloud(id:string){if(!backendEnabled)return;try{await resetBackendEmployeeDevice(id)}catch(error){console.warn("Cloud device reset deferred:",error)}}
