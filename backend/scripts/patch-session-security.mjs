import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/index.ts", import.meta.url);
let source = readFileSync(path, "utf8");

const constantsOld = 'const SESSION_COOKIE = "hadir_session";\nconst now=()=>new Date().toISOString(); const uid=()=>crypto.randomUUID();';
const constantsNew = 'const SESSION_COOKIE = "hadir_session";\nconst SESSION_IDLE_TIMEOUT_MS = 6 * 30 * 24 * 60 * 60 * 1000;\nconst SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;\nconst now=()=>new Date().toISOString(); const uid=()=>crypto.randomUUID();';
if (!source.includes(constantsOld) && !source.includes('const SESSION_IDLE_TIMEOUT_MS = 6 * 30 * 24 * 60 * 60 * 1000;')) {
  if (!source.includes(constantsOld)) throw new Error("Session security patch: constants anchor not found");
  source = source.replace(constantsOld, constantsNew);
}

const selectOld = 'SELECT user_id,user_type,role FROM auth_sessions WHERE token_hash=? LIMIT 1';
const selectNew = 'SELECT user_id,user_type,role,created_at,last_seen_at,revoked_at FROM auth_sessions WHERE token_hash=? LIMIT 1';
if (source.includes(selectOld)) {
  source = source.replace(selectOld, selectNew);
} else if (!source.includes(selectNew)) {
  throw new Error("Session security patch: auth_sessions SELECT anchor not found");
}

const guardOld = 'if(session){if(session.user_type==="admin"){';
const guardNew = 'if(session){const createdAt=Date.parse(String(session.created_at||""));const lastSeenAt=Date.parse(String(session.last_seen_at||""));const current=Date.now();if(session.revoked_at||!Number.isFinite(createdAt)||!Number.isFinite(lastSeenAt)||current-createdAt>SESSION_MAX_AGE_MS||current-lastSeenAt>SESSION_IDLE_TIMEOUT_MS){await env.DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(now(),tokenHash).run().catch(()=>undefined);return null;}if(session.user_type==="admin"){';
if (source.includes(guardOld)) {
  source = source.replace(guardOld, guardNew);
} else if (!source.includes('current-createdAt>SESSION_MAX_AGE_MS')) {
  throw new Error("Session security patch: session guard anchor not found");
}

const writeOld = 'UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=?';
const writeNew = 'UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=? AND revoked_at IS NULL';
source = source.replaceAll(writeOld, writeNew);

writeFileSync(path, source, "utf8");
console.log("Session security patch applied: 6-month idle timeout + 1-year absolute lifetime + revoked-session guard.");
