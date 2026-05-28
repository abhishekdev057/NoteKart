export function getPhonePeBaseUrl() {
  return process.env.PHONEPE_ENV === "production"
    ? "https://api.phonepe.com/apis/pg"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

/** Returns an OAuth token, or null when PhonePe credentials are not configured. */
export async function getPhonePeAccessToken(): Promise<string | null> {
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const clientVersion = process.env.PHONEPE_CLIENT_VERSION ?? "1";

  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    client_version: clientVersion,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${getPhonePeBaseUrl()}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`PhonePe auth failed with ${response.status}`);
  }

  const data = await response.json();
  return String(data.access_token ?? data.data?.access_token ?? "");
}

export function normalizePhonePeState(data: Record<string, unknown>) {
  const nested = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};
  const raw = String(
    data.state ?? data.status ?? nested.state ?? nested.status ?? data.code ?? "",
  ).toUpperCase();

  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS", "SUCCESSFUL"].includes(raw)) return "COMPLETED";
  if (["FAILED", "FAILURE", "PAYMENT_ERROR", "DECLINED", "TIMED_OUT"].includes(raw)) return "FAILED";
  if (["CANCELLED", "CANCELED", "USER_CANCELLED"].includes(raw)) return "CANCELLED";
  return "PENDING";
}

/** Extract the paise amount PhonePe reports for a transaction, if present. */
export function extractPhonePeAmount(data: Record<string, unknown>): number | null {
  const nested = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};
  const value = data.amount ?? nested.amount;
  return typeof value === "number" ? value : null;
}

export function userMessageForState(state: string) {
  if (state === "COMPLETED") return "Payment received. Your NoteKart order is confirmed.";
  if (state === "FAILED") return "Payment failed. No confirmed payment was received for this order.";
  if (state === "CANCELLED") return "Payment was cancelled. You can return to cart and try again.";
  return "Payment is still pending. We are checking PhonePe again automatically.";
}
