import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(filePath, source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`Session security patch: ${label} anchor not found`);
  return source.replace(oldText, newText);
}

const indexPath = new URL("../src/index.ts", import.meta.url);
let indexSource = readFileSync(indexPath, "utf8");

const constantsOld = 'const SESSION_COOKIE = "hadir_session";\nconst now=()=>new Date().toISOString(); const uid=()=>crypto.randomUUID();';
const constantsNew = 'const SESSION_COOKIE = "hadir_session";\nconst SESSION_IDLE_TIMEOUT_MS = 6 * 30 * 24 * 60 * 60 * 1000;\nconst SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;\nconst SESSION_TOUCH_INTERVAL_SECONDS = 15 * 60;\nconst now=()=>new Date().toISOString(); const uid=()=>crypto.randomUUID();';
if (!indexSource.includes('const SESSION_IDLE_TIMEOUT_MS = 6 * 30 * 24 * 60 * 60 * 1000;')) {
  indexSource = replaceOnce(indexPath, indexSource, constantsOld, constantsNew, "constants");
} else if (!indexSource.includes('const SESSION_TOUCH_INTERVAL_SECONDS = 15 * 60;')) {
  indexSource = replaceOnce(indexPath, indexSource, 'const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;\n', 'const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;\nconst SESSION_TOUCH_INTERVAL_SECONDS = 15 * 60;\n', "touch interval constant");
}

const selectOld = 'SELECT user_id,user_type,role FROM auth_sessions WHERE token_hash=? LIMIT 1';
const selectNew = 'SELECT user_id,user_type,role,created_at,last_seen_at,revoked_at FROM auth_sessions WHERE token_hash=? LIMIT 1';
if (indexSource.includes(selectOld)) {
  indexSource = indexSource.replace(selectOld, selectNew);
} else if (!indexSource.includes(selectNew)) {
  throw new Error("Session security patch: auth_sessions SELECT anchor not found");
}

const guardOld = 'if(session){if(session.user_type==="admin"){';
const guardNew = 'if(session){const createdAt=Date.parse(String(session.created_at||""));const lastSeenAt=Date.parse(String(session.last_seen_at||""));const current=Date.now();if(session.revoked_at||!Number.isFinite(createdAt)||!Number.isFinite(lastSeenAt)||current-createdAt>SESSION_MAX_AGE_MS||current-lastSeenAt>SESSION_IDLE_TIMEOUT_MS){await env.DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(now(),tokenHash).run().catch(()=>undefined);return null;}if(session.user_type==="admin"){';
if (indexSource.includes(guardOld)) {
  indexSource = indexSource.replace(guardOld, guardNew);
} else if (!indexSource.includes('current-createdAt>SESSION_MAX_AGE_MS')) {
  throw new Error("Session security patch: session guard anchor not found");
}

const writeOld = 'UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=?';
const writeNew = 'UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=? AND revoked_at IS NULL AND (last_seen_at IS NULL OR last_seen_at <= datetime(\'now\', \'-15 minutes\'))';
indexSource = indexSource.replaceAll(writeOld, writeNew);

const bearerFirst = 'req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||getCookie(req,SESSION_COOKIE)';
const cookieFirst = 'getCookie(req,SESSION_COOKIE)||req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")';
indexSource = indexSource.replaceAll(cookieFirst, bearerFirst);
writeFileSync(indexPath, indexSource, "utf8");

const entryPath = new URL("../src/entry.ts", import.meta.url);
let entrySource = readFileSync(entryPath, "utf8");
const entryCookieFirst = '(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||"").trim()';
const entryBearerFirst = '(request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||readCookie(request,SESSION_COOKIE)||"").trim()';
entrySource = replaceOnce(entryPath, entrySource, entryCookieFirst, entryBearerFirst, "entry bearer precedence");
writeFileSync(entryPath, entrySource, "utf8");

const aiPath = new URL("../src/ai-entry.ts", import.meta.url);
let aiSource = readFileSync(aiPath, "utf8");
const aiCookieFirst = '(readCookie(request,SESSION_COOKIE)||request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||"").trim()';
const aiBearerFirst = '(request.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||readCookie(request,SESSION_COOKIE)||"").trim()';
aiSource = replaceOnce(aiPath, aiSource, aiCookieFirst, aiBearerFirst, "AI gateway bearer precedence");
writeFileSync(aiPath, aiSource, "utf8");

const gatewayPath = new URL("../src/employee-save-production-gateway.ts", import.meta.url);
let gatewaySource = readFileSync(gatewayPath, "utf8");
const gatewayCookieFirst = 'return item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) : (req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "").trim() || "");';
const gatewayBearerFirst = 'return req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "").trim() || (item ? decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)) : "");';
gatewaySource = replaceOnce(gatewayPath, gatewaySource, gatewayCookieFirst, gatewayBearerFirst, "production gateway bearer precedence");
writeFileSync(gatewayPath, gatewaySource, "utf8");

const workforcePath = new URL("../src/workforce.ts", import.meta.url);
let workforceSource = readFileSync(workforcePath, "utf8");
if (!workforceSource.includes('import { sendUserPush } from "./push";')) {
  workforceSource = 'import { sendUserPush } from "./push";\n' + workforceSource;
}
const workforceEnvOld = 'type Env={DB:D1Database;PROFILE_IMAGES?:R2Bucket};';
const workforceEnvNew = 'type Env={DB:D1Database;PROFILE_IMAGES?:R2Bucket;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string};';
if (workforceSource.includes(workforceEnvOld)) workforceSource = workforceSource.replace(workforceEnvOld, workforceEnvNew);
else if (!workforceSource.includes('VAPID_PUBLIC_KEY?:string')) throw new Error("Workforce push patch: Env anchor not found");
const workforceNotifyOld = 'async function notify(db:D1Database,u:string,t:string,b:string,severity="info",type="system"){await db.prepare("INSERT INTO notifications(id,recipient_id,title,body,severity,type,created_at) VALUES(?,?,?,?,?,?,?)").bind(id(),u,t,b,severity,type,now()).run();}';
const workforceNotifyNew = 'let workforcePushEnv:{VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string}|null=null;\nasync function notify(db:D1Database,u:string,t:string,b:string,severity="info",type="system"){const recipient=String(u||"").trim();if(!recipient)throw new Error("NOTIFICATION_RECIPIENT_REQUIRED");const createdAt=now();await db.prepare("INSERT INTO notifications(id,recipient_id,title,body,severity,type,created_at) VALUES(?,?,?,?,?,?,?)").bind(id(),recipient,t,b,severity,type,createdAt).run();const subscriptions=await db.prepare("SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?").bind(recipient).all<any>();const url=type==="device-rebind"?"/manager/requests":type==="violation"?"/manager/audit":"/manager/requests";for(const subscription of subscriptions.results||[]){try{const result=await sendUserPush(workforcePushEnv||{}, {endpoint:String(subscription.endpoint),keys:{p256dh:String(subscription.p256dh),auth:String(subscription.auth)}},{title:t,body:b,url,type,tag:`hadir-${type}`});if(result.status===404||result.status===410)await db.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(subscription.id).run().catch(()=>undefined);}catch{}}}';
if (workforceSource.includes(workforceNotifyOld)) workforceSource = workforceSource.replace(workforceNotifyOld, workforceNotifyNew);
else if (!workforceSource.includes('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?')) throw new Error("Workforce push patch: notify anchor not found");
const workforceHandlerOld = 'export async function handleWorkforce(req:Request,env:Env,actor:Actor|null,pathname:string){await ensureWorkforceSchema(env.DB);';
const workforceHandlerNew = 'export async function handleWorkforce(req:Request,env:Env,actor:Actor|null,pathname:string){workforcePushEnv=env;await ensureWorkforceSchema(env.DB);';
if (workforceSource.includes(workforceHandlerOld)) workforceSource = workforceSource.replace(workforceHandlerOld, workforceHandlerNew);
else if (!workforceSource.includes('workforcePushEnv=env;')) throw new Error("Workforce push patch: handler anchor not found");
writeFileSync(workforcePath, workforceSource, "utf8");

console.log("Session + workforce notification patch applied: secure session lifetime, bearer-token precedence, reduced D1 session write amplification, and Web Push delivery for workforce events.");
