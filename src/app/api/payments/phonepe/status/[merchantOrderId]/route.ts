import { NextResponse } from "next/server";
import { updateOrderPaymentStatusByPhonePe } from "@/lib/db";

type Context = { params: Promise<{ merchantOrderId: string }> };

function getPhonePeBaseUrl() {
  return process.env.PHONEPE_ENV === "production"
    ? "https://api.phonepe.com/apis/pg"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

async function getPhonePeAccessToken() {
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

  if (!response.ok) throw new Error("PhonePe auth failed.");
  const data = await response.json();
  return String(data.access_token ?? data.data?.access_token ?? "");
}

function normalizePhonePeState(data: Record<string, unknown>) {
  const nestedData = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};
  const rawState = String(data.state ?? data.status ?? nestedData.state ?? nestedData.status ?? data.code ?? "").toUpperCase();

  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS", "SUCCESSFUL"].includes(rawState)) return "COMPLETED";
  if (["FAILED", "FAILURE", "PAYMENT_ERROR", "DECLINED", "TIMED_OUT"].includes(rawState)) return "FAILED";
  if (["CANCELLED", "CANCELED", "USER_CANCELLED"].includes(rawState)) return "CANCELLED";
  return "PENDING";
}

function userMessageForState(state: string) {
  if (state === "COMPLETED") return "Payment received. Your NoteKart order is confirmed.";
  if (state === "FAILED") return "Payment failed. No confirmed payment was received for this order.";
  if (state === "CANCELLED") return "Payment was cancelled. You can return to cart and try again.";
  return "Payment is still pending. We are checking PhonePe again automatically.";
}

export async function GET(_request: Request, context: Context) {
  try {
    const { merchantOrderId } = await context.params;
    const accessToken = await getPhonePeAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        mock: true,
        merchantOrderId,
        state: "PENDING",
        normalizedState: "PENDING",
        message: "PhonePe credentials are not configured.",
      });
    }

    const response = await fetch(`${getPhonePeBaseUrl()}/checkout/v2/order/${merchantOrderId}/status`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    const normalizedState = normalizePhonePeState(data);

    if (response.ok) {
      const paymentStatus = normalizedState === "COMPLETED" ? "paid" : normalizedState.toLowerCase();
      await updateOrderPaymentStatusByPhonePe(merchantOrderId, paymentStatus);
    }

    return NextResponse.json(
      {
        ...data,
        merchantOrderId,
        normalizedState,
        message: userMessageForState(normalizedState),
      },
      { status: response.status },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check PhonePe status." }, { status: 500 });
  }
}
