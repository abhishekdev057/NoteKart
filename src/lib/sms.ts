import { normalizeMobile } from "./auth";

export type SmsResult = {
  /** true when the message was handed to a real SMS provider. */
  delivered: boolean;
  /** Provider name or "dev" for the console fallback. */
  provider: string;
};

const COUNTRY_CODE = process.env.SMS_COUNTRY_CODE ?? "91";

function withCountryCode(mobile: string) {
  return `${COUNTRY_CODE}${normalizeMobile(mobile)}`;
}

async function sendViaMsg91(mobile: string, code: string): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY!;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const sender = process.env.MSG91_SENDER_ID;

  // MSG91 OTP API — the template should reference ##OTP## (or {{otp}}) as the variable.
  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify({
      template_id: templateId,
      mobile: withCountryCode(mobile),
      sender,
      otp: code,
      otp_expiry: 5,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`MSG91 send failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return { delivered: true, provider: "msg91" };
}

async function sendViaTwilio(mobile: string, code: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const body = new URLSearchParams({
    To: `+${withCountryCode(mobile)}`,
    From: from,
    Body: `Your NoteKart verification code is ${code}. It expires in 5 minutes.`,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twilio send failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return { delivered: true, provider: "twilio" };
}

/**
 * Send an OTP via the configured provider. Selection is by SMS_PROVIDER, or
 * auto-detected from whichever credentials are present. When nothing is
 * configured we fall back to logging the code to the server console so the
 * flow is fully testable in development without an SMS account.
 */
export async function sendOtpSms(mobile: string, code: string): Promise<SmsResult> {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();

  try {
    if (provider === "msg91" || (!provider && process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID)) {
      return await sendViaMsg91(mobile, code);
    }
    if (provider === "twilio" || (!provider && process.env.TWILIO_ACCOUNT_SID)) {
      return await sendViaTwilio(mobile, code);
    }
  } catch (error) {
    console.error("[notekart] SMS provider error:", error);
    // Surface as a server error so the request handler returns 500 rather than
    // silently pretending the code was sent.
    throw error;
  }

  // Dev fallback: no provider configured.
  console.warn(
    `[notekart] No SMS provider configured. OTP for ${normalizeMobile(mobile)} is ${code} (dev only).`,
  );
  return { delivered: false, provider: "dev" };
}
