import { normalizeMobile } from "./auth";

type Msg91VerifyResponse = Record<string, unknown>;

function findString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct;
  }
  for (const nested of Object.values(record)) {
    const found = findString(nested, keys);
    if (found) return found;
  }
  return null;
}

function findBoolean(value: unknown, keys: string[]): boolean | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "boolean") return direct;
  }
  for (const nested of Object.values(record)) {
    const found = findBoolean(nested, keys);
    if (found !== null) return found;
  }
  return null;
}

function isSuccessResponse(data: Msg91VerifyResponse) {
  const ok = findBoolean(data, ["success", "verified", "isVerified", "is_verified"]);
  if (ok === true) return true;
  if (ok === false) return false;

  const type = findString(data, ["type", "status", "message"]);
  if (!type) return false;
  if (/error|fail|invalid|expired|not/i.test(type)) return false;
  return /success|verified|valid|approved/i.test(type);
}

function verifiedIdentifier(data: Msg91VerifyResponse) {
  const raw = findString(data, ["identifier", "mobile", "phone", "number", "user"]);
  if (!raw) return null;
  const mobile = normalizeMobile(raw);
  return mobile.length === 10 ? mobile : null;
}

export async function verifyMsg91WidgetAccessToken(accessToken: string, expectedMobile: string) {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) throw new Error("MSG91_AUTH_KEY is not configured.");

  const body = new URLSearchParams({
    authkey: authKey,
    "access-token": accessToken,
  });

  const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json().catch(() => ({}))) as Msg91VerifyResponse;
  if (!response.ok || !isSuccessResponse(data)) {
    console.warn("[notekart] MSG91 access token verification rejected:", {
      status: response.status,
      keys: Object.keys(data),
      type: findString(data, ["type", "status", "message"]),
      message: findString(data, ["message"]),
      hasError: findBoolean(data, ["hasError"]),
      success: findBoolean(data, ["success", "verified", "isVerified", "is_verified"]),
    });
    return { ok: false as const, error: "MSG91 could not verify this OTP session." };
  }

  const verifiedMobile = verifiedIdentifier(data);
  const normalizedExpected = normalizeMobile(expectedMobile);
  if (verifiedMobile && verifiedMobile !== normalizedExpected) {
    return { ok: false as const, error: "Verified mobile does not match this login request." };
  }

  return { ok: true as const, mobile: verifiedMobile ?? normalizedExpected };
}
