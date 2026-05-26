import { NextResponse } from "next/server";

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

export async function GET(_request: Request, context: Context) {
  try {
    const { merchantOrderId } = await context.params;
    const accessToken = await getPhonePeAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        mock: true,
        merchantOrderId,
        state: "PENDING",
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
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check PhonePe status." }, { status: 500 });
  }
}
