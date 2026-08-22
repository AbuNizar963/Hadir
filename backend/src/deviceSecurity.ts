import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";

export type DeviceSecurityEnv = {
  DB: D1Database;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ORIGIN?: string;
};

const RP_NAME = "HADIR · حاضر";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function rpId(env: DeviceSecurityEnv): string {
  return String(env.WEBAUTHN_RP_ID || "abunizar963.github.io").trim();
}
function origin(env: DeviceSecurityEnv): string {
  return String(env.WEBAUTHN_ORIGIN || `https://${rpId(env)}`).trim().replace(/\/$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function bindEmployeeDevice(
  env: DeviceSecurityEnv,
  employeeId: string,
  deviceId: string,
  deviceLabel: string,
  fingerprint: string,
): Promise<{ bound: boolean; firstBind: boolean }> {
  const cleanDeviceId = deviceId.trim();
  if (!cleanDeviceId) return { bound: false, firstBind: false };
  const employee = await env.DB.prepare(
    "SELECT device_id AS deviceId, device_fingerprint AS deviceFingerprint FROM employees WHERE id=? LIMIT 1",
  ).bind(employeeId).first<{ deviceId: string | null; deviceFingerprint: string | null }>();
  if (!employee) throw new Error("الموظف غير موجود في D1.");

  const now = new Date().toISOString();
  const fingerprintHash = fingerprint.trim() ? await sha256Hex(fingerprint.trim()) : null;
  const hasBinding = Boolean(employee.deviceId || employee.deviceFingerprint);

  if (!hasBinding) {
    await env.DB.prepare(
      "UPDATE employees SET device_id=?, device_label=?, device_fingerprint=?, device_bound_at=?, device_last_seen_at=? WHERE id=? AND (device_id IS NULL OR TRIM(device_id)='') AND (device_fingerprint IS NULL OR TRIM(device_fingerprint)='')",
    ).bind(cleanDeviceId, deviceLabel.slice(0, 120), fingerprintHash, now, now, employeeId).run();
    return { bound: true, firstBind: true };
  }

  const idMatches = Boolean(employee.deviceId && employee.deviceId === cleanDeviceId);
  const fingerprintMatches = Boolean(
    employee.deviceFingerprint && fingerprintHash && employee.deviceFingerprint === fingerprintHash,
  );
  if (!idMatches || !fingerprintMatches) return { bound: false, firstBind: false };

  await env.DB.prepare(
    "UPDATE employees SET device_last_seen_at=?, device_label=COALESCE(?,device_label) WHERE id=?",
  ).bind(now, deviceLabel.slice(0, 120), employeeId).run();
  return { bound: true, firstBind: false };
}

export async function deviceStatus(env: DeviceSecurityEnv, employeeId: string) {
  const row = await env.DB.prepare(
    "SELECT device_id AS deviceId, device_label AS deviceLabel, device_bound_at AS deviceBoundAt, device_last_seen_at AS deviceLastSeenAt FROM employees WHERE id=? LIMIT 1",
  ).bind(employeeId).first<any>();
  const passkey = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM employee_passkeys WHERE employee_id=?",
  ).bind(employeeId).first<{ count: number }>();
  return {
    bound: Boolean(row?.deviceId),
    deviceLabel: row?.deviceLabel || null,
    deviceBoundAt: row?.deviceBoundAt || null,
    deviceLastSeenAt: row?.deviceLastSeenAt || null,
    passkeyCount: Number(passkey?.count || 0),
  };
}

async function saveChallenge(env: DeviceSecurityEnv, employeeId: string, kind: "registration" | "authentication", challenge: string) {
  const now = new Date();
  await env.DB.prepare("DELETE FROM webauthn_challenges WHERE employee_id=? AND kind=?").bind(employeeId, kind).run();
  await env.DB.prepare(
    "INSERT INTO webauthn_challenges(id,employee_id,kind,challenge,expires_at,created_at) VALUES(?,?,?,?,?,?)",
  ).bind(crypto.randomUUID(), employeeId, kind, challenge, new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(), now.toISOString()).run();
}

async function takeChallenge(env: DeviceSecurityEnv, employeeId: string, kind: "registration" | "authentication") {
  const row = await env.DB.prepare(
    "SELECT id,challenge,expires_at AS expiresAt FROM webauthn_challenges WHERE employee_id=? AND kind=? ORDER BY created_at DESC LIMIT 1",
  ).bind(employeeId, kind).first<{ id: string; challenge: string; expiresAt: string }>();
  if (!row || Date.parse(row.expiresAt) < Date.now()) return null;
  await env.DB.prepare("DELETE FROM webauthn_challenges WHERE id=?").bind(row.id).run();
  return row.challenge;
}

export async function registrationOptions(env: DeviceSecurityEnv, employeeId: string, jobNumber: string, name: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const credentials = await env.DB.prepare(
    "SELECT credential_id AS id, transports FROM employee_passkeys WHERE employee_id=?",
  ).bind(employeeId).all<any>();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(env),
    userName: jobNumber,
    userDisplayName: name,
    userID: new TextEncoder().encode(employeeId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: (credentials.results || []).map((row: any) => ({
      id: String(row.id),
      transports: row.transports ? JSON.parse(row.transports) : undefined,
    })),
    supportedAlgorithmIDs: [-7, -257],
  });
  await saveChallenge(env, employeeId, "registration", options.challenge);
  return options;
}

export async function verifyRegistration(env: DeviceSecurityEnv, employeeId: string, response: any) {
  const challenge = await takeChallenge(env, employeeId, "registration");
  if (!challenge) throw new Error("انتهت صلاحية عملية تسجيل مفتاح الجهاز. أعد المحاولة.");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin(env),
    expectedRPID: rpId(env),
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error("تعذر التحقق من مفتاح الجهاز.");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const transports = Array.isArray(response.response?.transports) ? JSON.stringify(response.response.transports) : null;
  await env.DB.prepare(
    "INSERT INTO employee_passkeys(id,employee_id,credential_id,public_key,counter,transports,device_type,backed_up,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
  ).bind(
    crypto.randomUUID(), employeeId, credential.id, credential.publicKey, credential.counter,
    transports, credentialDeviceType, credentialBackedUp ? 1 : 0, new Date().toISOString(),
  ).run();
  return { verified: true };
}

export async function clearEmployeeDevice(env: DeviceSecurityEnv, employeeId: string) {
  // Administrative reset is intentionally destructive: old sessions and
  // passkeys must not survive a device reset.
  await env.DB.batch([
    env.DB.prepare("UPDATE employees SET device_id=NULL, device_label=NULL, device_fingerprint=NULL, device_bound_at=NULL, device_last_seen_at=NULL WHERE id=?").bind(employeeId),
    env.DB.prepare("DELETE FROM employee_passkeys WHERE employee_id=?").bind(employeeId),
    env.DB.prepare("DELETE FROM webauthn_challenges WHERE employee_id=?").bind(employeeId),
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id=? AND user_type='employee'").bind(employeeId),
  ]);
}
