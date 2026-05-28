import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const FALLBACK_ADMINS = ["9256308961", "9461217285"];

export function normalizeMobile(mobile: string) {
  return mobile.replace(/\D/g, "").slice(-10);
}

export function isValidMobile(mobile: string) {
  return /^[6-9]\d{9}$/.test(normalizeMobile(mobile));
}

export function isAdminMobile(mobile: string) {
  const configured = process.env.ADMIN_MOBILES?.split(",").map(normalizeMobile).filter(Boolean);
  const admins = configured?.length ? configured : FALLBACK_ADMINS;
  return admins.includes(normalizeMobile(mobile));
}

/** Generate a cryptographically random 6-digit OTP code. */
export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Hash an OTP for storage so a database leak never exposes live codes.
 * Salted with the mobile number and the server secret.
 */
export function hashOtp(mobile: string, code: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${normalizeMobile(mobile)}:${code}`).digest("hex");
}

export function otpMatches(mobile: string, code: string, hash: string) {
  const expected = Buffer.from(hashOtp(mobile, code));
  const actual = Buffer.from(hash);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
