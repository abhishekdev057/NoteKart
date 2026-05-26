import { NextResponse } from "next/server";

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

  if (!response.ok) {
    throw new Error(`PhonePe auth failed with ${response.status}`);
  }

  const data = await response.json();
  return String(data.access_token ?? data.data?.access_token ?? "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Math.max(1, Number(body.amount ?? 0));
    const merchantOrderId = `notekart_${Date.now()}`;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const redirectUrl = `${siteUrl.replace(/\/$/, "")}/payment/phonepe/redirect?merchantOrderId=${merchantOrderId}`;
    const accessToken = await getPhonePeAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        mock: true,
        merchantOrderId,
        redirectUrl: null,
        message: "PhonePe credentials are not configured. Demo order created.",
      });
    }

    const response = await fetch(`${getPhonePeBaseUrl()}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `O-Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        merchantOrderId,
        amount: amount * 100,
        expireAfter: 1200,
        metaInfo: {
          udf1: "NoteKart",
          udf2: String(body.mobile ?? ""),
        },
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "NoteKart notebook order payment",
          merchantUrls: { redirectUrl },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? "Unable to create PhonePe payment." }, { status: response.status });
    }

    const paymentUrl =
      data.redirectUrl ??
      data.data?.redirectUrl ??
      data.data?.paymentUrl ??
      data.data?.instrumentResponse?.redirectInfo?.url ??
      data.url ??
      null;

    return NextResponse.json({ merchantOrderId, redirectUrl: paymentUrl, raw: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PhonePe payment." }, { status: 500 });
  }
}
