export type DiagnosticLevel = "error" | "warning" | "info";
export type DiagnosticEntry = { id:string; timestamp:string; level:DiagnosticLevel; code:string; message:string; stack?:string; context?:Record<string,unknown> };
const KEY="hadir_diagnostics_v1";
const read=():DiagnosticEntry[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
export function recordDiagnostic(level:DiagnosticLevel,code:string,message:string,error?:unknown,context?:Record<string,unknown>){const e:DiagnosticEntry={id:crypto.randomUUID?.()||String(Date.now()),timestamp:new Date().toISOString(),level,code,message,stack:error instanceof Error?error.stack:typeof error==="string"?error:undefined,context};const all=[e,...read()].slice(0,300);try{localStorage.setItem(KEY,JSON.stringify(all))}catch{};return e}
export function getDiagnostics(){return read()}
export function clearDiagnostics(){localStorage.removeItem(KEY)}
export function installGlobalDiagnostics(){window.addEventListener("error",e=>recordDiagnostic("error","JS_RUNTIME_ERROR",e.message,e.error,{source:e.filename,line:e.lineno,column:e.colno}));window.addEventListener("unhandledrejection",e=>recordDiagnostic("error","UNHANDLED_PROMISE",String(e.reason),e.reason));}
