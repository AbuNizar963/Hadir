const PWA_SESSION_STORAGE_KEYS = { employee: "hadir_pwa_token.employee", admin: "hadir_pwa_token.admin" } as const;
const LEGACY_PWA_SESSION_STORAGE_KEY = "hadir_pwa_token";
const LAST_ROLE_KEY = "hadir_pwa_last_role";
const PWA_DB_NAME = "hadir-auth";
const PWA_DB_VERSION = 2;
const PWA_STORE = "session";
const PWA_KEYS = { employee: "employee", admin: "admin" } as const;
const API_URL = String(import.meta.env.VITE_API_URL || "https://hadir-api.abunizar963.workers.dev").trim().replace(/\/$/, "");
type PwaRole = keyof typeof PWA_SESSION_STORAGE_KEYS;
type StoredSession = { token: string; savedAt: number };

type SessionUser = { id?: string; role?: string; username?: string; jobNumber?: string; name?: string };
type SessionResponse = { user?: SessionUser };

function isBrowser(){return typeof window!=="undefined"&&typeof document!=="undefined";}
function roleMatches(role:PwaRole,userRole:unknown){const actual=String(userRole||"").toLowerCase();return role==="admin"?["owner","manager","supervisor","admin"].includes(actual):["employee","staff"].includes(actual);}
function openSessionDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(!isBrowser()||!window.indexedDB){reject(new Error("PWA_IDB_UNAVAILABLE"));return}const request=window.indexedDB.open(PWA_DB_NAME,PWA_DB_VERSION);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(PWA_STORE))db.createObjectStore(PWA_STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("PWA_IDB_OPEN_FAILED"))})}
async function writeIndexedSession(role:PwaRole,token:string):Promise<void>{const db=await openSessionDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(PWA_STORE,"readwrite");tx.objectStore(PWA_STORE).put({token,savedAt:Date.now()} satisfies StoredSession,PWA_KEYS[role]);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("PWA_IDB_WRITE_FAILED"));tx.onabort=()=>reject(tx.error||new Error("PWA_IDB_WRITE_ABORTED"))});db.close();try{await navigator.storage?.persist?.()}catch{}}
async function readIndexedSession(role:PwaRole):Promise<string>{try{const db=await openSessionDb();const stored=await new Promise<StoredSession|undefined>((resolve,reject)=>{const tx=db.transaction(PWA_STORE,"readonly");const request=tx.objectStore(PWA_STORE).get(PWA_KEYS[role]);request.onsuccess=()=>resolve(request.result as StoredSession|undefined);request.onerror=()=>reject(request.error||new Error("PWA_IDB_READ_FAILED"))});db.close();return typeof stored?.token==="string"?stored.token:""}catch{return ""}}
async function deleteIndexedSession(role:PwaRole):Promise<void>{try{const db=await openSessionDb();await new Promise<void>(resolve=>{const tx=db.transaction(PWA_STORE,"readwrite");tx.objectStore(PWA_STORE).delete(PWA_KEYS[role]);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()});db.close()}catch{}}
export async function persistPwaSession(token:string,role?:PwaRole):Promise<void>{if(!isBrowser()||!token)return;let resolvedRole=role;if(!resolvedRole){try{if(localStorage.getItem("hadir.api.token.admin")===token)resolvedRole="admin";else if(localStorage.getItem("hadir.api.token.employee")===token)resolvedRole="employee"}catch{}}resolvedRole||="employee";try{localStorage.setItem(PWA_SESSION_STORAGE_KEYS[resolvedRole],token);localStorage.setItem(LAST_ROLE_KEY,resolvedRole)}catch{}await writeIndexedSession(resolvedRole,token).catch(()=>undefined)}
export function getLastPwaRole():PwaRole|undefined{if(!isBrowser())return undefined;try{const role=localStorage.getItem(LAST_ROLE_KEY);return role==="employee"||role==="admin"?role:undefined}catch{return undefined}}
export function clearPwaSession(role?:PwaRole):void{if(!isBrowser())return;if(role){try{localStorage.removeItem(PWA_SESSION_STORAGE_KEYS[role]);if(getLastPwaRole()===role)localStorage.removeItem(LAST_ROLE_KEY)}catch{}void deleteIndexedSession(role);return}for(const key of Object.values(PWA_SESSION_STORAGE_KEYS)){try{localStorage.removeItem(key)}catch{}}try{localStorage.removeItem(LEGACY_PWA_SESSION_STORAGE_KEY);localStorage.removeItem(LAST_ROLE_KEY)}catch{}void Promise.all((Object.keys(PWA_SESSION_STORAGE_KEYS) as PwaRole[]).map(deleteIndexedSession))}
export function getPwaSessionToken(role?:PwaRole):string{if(!isBrowser())return "";if(role){try{return localStorage.getItem(PWA_SESSION_STORAGE_KEYS[role])||""}catch{return ""}}try{const admin=localStorage.getItem(PWA_SESSION_STORAGE_KEYS.admin);if(admin)return admin;const employee=localStorage.getItem(PWA_SESSION_STORAGE_KEYS.employee);if(employee)return employee;return localStorage.getItem(LEGACY_PWA_SESSION_STORAGE_KEY)||""}catch{return ""}}

async function fetchSession(role:PwaRole,token:string):Promise<SessionResponse|null>{
  const headers=new Headers({accept:"application/json"});
  if(token)headers.set("authorization",`Bearer ${token}`);
  const response=await fetch(`${API_URL}/api/me`,{method:"GET",credentials:"include",cache:"no-store",headers});
  const data=await response.json().catch(()=>({})) as SessionResponse;
  if(!response.ok||!data?.user||!roleMatches(role,data.user.role))return null;
  return data;
}

async function recoverRole(role:PwaRole):Promise<SessionResponse|null>{
  let token=getPwaSessionToken(role);
  if(!token)token=await readIndexedSession(role);
  try{
    const data=await fetchSession(role,token);
    if(!data?.user)return null;
    try{localStorage.setItem(LAST_ROLE_KEY,role);if(token)localStorage.setItem(role==="admin"?"hadir.api.token.admin":"hadir.api.token.employee",token)}catch{}
    if(token)await writeIndexedSession(role,token).catch(()=>undefined);
    return data;
  }catch{return null}
}

export async function restorePwaSession(role?:PwaRole):Promise<SessionResponse>{
  const last=getLastPwaRole();
  const roles:PwaRole[]=role?[role]:last?[last,last==="admin"?"employee":"admin"]:["employee","admin"];
  for(const candidate of roles){const data=await recoverRole(candidate);if(data?.user)return data;}
  throw new Error("PWA_SESSION_MISSING");
}
