import { generateOtp, hashOtp, normalizeMobile, otpMatches } from "./auth";
import { consumeRateLimit, deleteOtp, getActiveOtp, incrementOtpAttempts, saveOtp } from "./db";
import { sendOtpSms } from "./sms";

const OTP_TTL_SECONDS = 5 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

// Rate limits to make brute force / SMS-bombing impractical.
const SEND_PER_MOBILE_PER_HOUR = 5;
const SEND_PER_IP_PER_HOUR = 15;

export type RequestOtpResult =
  | { ok: true; delivered: true; provider: string }
  | { ok: false; status: number; error: string };

export async function requestOtp(mobile: string, ip: string): Promise<RequestOtpResult> {
  const normalized = normalizeMobile(mobile);

  const mobileOk = await consumeRateLimit(`otp:send:mobile:${normalized}`, SEND_PER_MOBILE_PER_HOUR, 3600);
  const ipOk = await consumeRateLimit(`otp:send:ip:${ip}`, SEND_PER_IP_PER_HOUR, 3600);
  if (!mobileOk || !ipOk) {
    return { ok: false, status: 429, error: "Too many OTP requests. Please try again later." };
  }

  const code = generateOtp();
  await saveOtp(normalized, hashOtp(normalized, code), OTP_TTL_SECONDS);
  const result = await sendOtpSms(normalized, code);

  return { ok: true, delivered: true, provider: result.provider };
}

export type VerifyOtpResult = { ok: true } | { ok: false; status: number; error: string };

export async function verifyOtp(mobile: string, code: string): Promise<VerifyOtpResult> {
  const normalized = normalizeMobile(mobile);
  const record = await getActiveOtp(normalized);

  if (!record) {
    return { ok: false, status: 401, error: "Code expired or not requested. Request a new OTP." };
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await deleteOtp(normalized);
    return { ok: false, status: 429, error: "Too many incorrect attempts. Request a new OTP." };
  }
  if (!otpMatches(normalized, code, record.codeHash)) {
    await incrementOtpAttempts(normalized);
    return { ok: false, status: 401, error: "Incorrect OTP. Please try again." };
  }

  await deleteOtp(normalized);
  return { ok: true };
}
