import type { AttendanceRecord, AuditEntry, Employee, EmployeeRequest, RequestType, Settings, AdminAccount } from "@/types";
import { hash } from "@/lib/hash";
import { generateId } from "@/lib/utils";
import { getDeviceId, getClientIpPlaceholder } from "@/lib/device";
import { backendEnabled, createBackendAttendance, createBackendRequest, updateBackendRequest, saveBackendSettings } from "@/lib/backend";
import { syncEmployeesToCloud, removeEmployeeFromCloud } from "@/lib/cloudSync";
import { getD1View } from "@/lib/d1View";
import { hydrateLocalData } from "@/lib/cloudDataSync";
export type { EmployeeRequest, RequestType } from "@/types";

const K={SESSION:"hadir.session",MANAGER_SESSION:"hadir.manager_session"} as const;
const DEFAULT_OWNER_USERNAME="AbuNizar",DEFAULT_OWNER_PASSWORD="963963963";
export const defaultSettings:Settings={qrCode:"HADIR-SITE-01-STATIC",workSiteLat:24.7136,workSiteLng:46.6753,radiusMeters:100,workStart:"08:00",workEnd:"16:00",lateGraceMinutes:10,ownerUsername:DEFAULT_OWNER_USERNAME,ownerPasswordHash:hash(DEFAULT_OWNER_PASSWORD),ownerName:"المالك",managerUsername:"",managerPasswordHash:"",managerName:"",supervisorUsername:"",supervisorPasswordHash:"",supervisorName:"",adminAccounts:[{id:"owner-account",username:DEFAULT_OWNER_USERNAME,passwordHash:hash(DEFAULT_OWNER_PASSWORD),name:"المالك",role:"owner",active:true,createdAt:new Date(0).toISOString()}],brandName:"حاضِر",brandLogo:null,locations:[]};

export function getSettings():Settings{return backendEnabled?(getD1View().settings||defaultSettings):defaultSettings;}
export function saveSettings(next:Settings):void{if(backendEnabled){void saveBackendSettings(next).then(()=>hydrateLocalData());return;} if(typeof window!=="undefined")window.dispatchEvent(new Event("hadir:settings-changed"));}
export function getEmployees():Employee[]{return backendEnabled?getD1View().employees:[];}
export function saveEmployees(list:Employee[],pins?:Record<string,string>):void{if(!backendEnabled)return;const remote=getD1View().employees;for(const oldEmployee of remote)if(!list.some(e=>e.id===oldEmployee.id||e.jobNumber===oldEmployee.jobNumber))void removeEmployeeFromCloud(oldEmployee.id);void syncEmployeesToCloud(list,pins).then(()=>hydrateLocalData());}
export function getAttendance():AttendanceRecord[]{return backendEnabled?getD1View().attendance:[];}
export function addAttendance(record:AttendanceRecord):void{if(!backendEnabled)return;void createBackendAttendance({...record,id:undefined as never,ip:undefined as never} as any).then(()=>hydrateLocalData());}
export function getAudit():AuditEntry[]{return backendEnabled?getD1View().audit:[];}
export function addAudit(_entry:AuditEntry):void{if(backendEnabled)return;}
export function getRequests():EmployeeRequest[]{return backendEnabled?getD1View().requests:[];}
export function addRequest(request:Omit<EmployeeRequest,"id"|"status"|"createdAt">):EmployeeRequest{const full={...request,id:generateId(),status:"pending" as const,createdAt:new Date().toISOString()};if(backendEnabled)void createBackendRequest(request).then(()=>hydrateLocalData());return full;}
export function updateRequestStatus(id:string,status:"approved"|"rejected"):void{if(backendEnabled)void updateBackendRequest(id,status).then(()=>hydrateLocalData());}
export interface Session{employeeId:string;jobNumber:string;name:string;loginAt:string;role?:string}
export interface ManagerSession{loginAt:string;name?:string;role?:string;jobNumber?:string;accountId?:string}
function readSession<T>(key:string):T|null{if(typeof window==="undefined")return null;try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:null;}catch{return null;}}
function writeSession<T>(key:string,value:T|null){if(typeof window==="undefined")return;if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}
export function getSession():Session|null{return readSession<Session>(K.SESSION)}
export function setSession(session:Session|null):void{writeSession(K.SESSION,session)}
export function getManagerSession():ManagerSession|null{return readSession<ManagerSession>(K.MANAGER_SESSION)}
export function setManagerSession(session:ManagerSession|null):void{writeSession(K.MANAGER_SESSION,session)}
export function seedIfEmpty():void{if(backendEnabled){void hydrateLocalData();return;}}
export function resetAll():void{if(backendEnabled)return;if(typeof window!=="undefined"){localStorage.removeItem(K.SESSION);localStorage.removeItem(K.MANAGER_SESSION);}}
export function findEmployeeByJobNumber(jobNumber:string):Employee|undefined{const n=jobNumber.trim();return getEmployees().find(e=>e.jobNumber.trim()===n)}
function parseTime(value:string):{hours:number;minutes:number}|null{const m/^(\d{1,2}):(\d{2})$/.exec(value);if(!m)return null;const hours=Number(m[1]),minutes=Number(m[2]);if(hours>23||minutes>59)return null;return{hours,minutes};}
export function isShiftOver(employee?:Employee):boolean{const settings=getSettings(),time=parseTime(employee?.workEndTime||settings.workEnd);if(!time)return false;const now=new Date(),end=new Date(now);end.setHours(time.hours,time.minutes,0,0);return now.getTime()>=end.getTime();}
export function forceCheckInByManager(employeeOrId:Employee|string,type:"check-in"|"check-out"|"checkIn"|"checkOut"):AttendanceRecord|null{const employee=typeof employeeOrId==="string"?getEmployees().find(i=>i.id===employeeOrId):getEmployees().find(i=>i.id===employeeOrId.id);if(!employee)return null;const normalizedType=type==="checkIn"?"check-in":type==="checkOut"?"check-out":type;const record:AttendanceRecord={id:generateId(),employeeId:employee.id,jobNumber:employee.jobNumber,employeeName:employee.name,type:normalizedType,timestamp:new Date().toISOString(),lat:0,lng:0,distanceMeters:0,deviceId:employee.deviceId||getDeviceId(),ip:getClientIpPlaceholder(),qrCode:"MANUAL",locationId:employee.locationId||"main"};addAttendance(record);return record;}
