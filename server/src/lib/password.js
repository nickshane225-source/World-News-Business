import crypto from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
export async function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 12) throw new Error("Admin password must be at least 12 characters");
  const salt = crypto.randomBytes(16), N = 16384, r = 8, p = 1;
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}
export async function verifyPasswordHash(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (!Number.isInteger(N) || N < 16384 || N > 262144 || !Number.isInteger(r) || r < 1 || r > 16 || !Number.isInteger(p) || p < 1 || p > 4) return false;
  try {
    const salt = Buffer.from(parts[4], "base64url"), expected = Buffer.from(parts[5], "base64url");
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, expected.length, { N, r, p, maxmem: 128 * 1024 * 1024 });
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
export async function verifyAdminPassword(password) {
  if (process.env.ADMIN_PASSWORD_HASH) return verifyPasswordHash(password, process.env.ADMIN_PASSWORD_HASH);
  if (process.env.ALLOW_LEGACY_ADMIN_PASSWORD === "false") return false;
  const legacy = process.env.ADMIN_PASSWORD;
  if (!legacy) return false;
  if (process.env.NODE_ENV === "production") console.warn("[security] Legacy ADMIN_PASSWORD is enabled. Configure ADMIN_PASSWORD_HASH and disable legacy authentication.");
  const a = Buffer.from(password), b = Buffer.from(legacy);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
