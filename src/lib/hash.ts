// Lightweight non-cryptographic hash for MVP demo purposes only.
// In production this MUST be replaced by a server-side bcrypt/argon2 hash.
export function hash(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const salted = `v1$${h.toString(16)}$${input.length}`;
  // add a second pass to make it slightly less trivial
  let h2 = 5381 >>> 0;
  for (let i = 0; i < salted.length; i++) {
    h2 = ((h2 << 5) + h2 + salted.charCodeAt(i)) >>> 0;
  }
  return `${h.toString(16)}-${h2.toString(16)}`;
}

export function verify(input: string, stored: string): boolean {
  return hash(input) === stored;
}
