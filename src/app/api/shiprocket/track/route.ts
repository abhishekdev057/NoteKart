import { NextResponse } from "next/server";

let tokenCache: { token: string; expires: number } | null = null;

async function getShiprocketToken() {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) return null;

  const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error("Shiprocket login failed.");
  const data = await response.json();
  tokenCache = { token: data.token, expires: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token as string;
}

export async function POST(request: Request) {
  try {
    const { awb } = await request.json();
    const token = await getShiprocketToken();

    if (!token) {
      return NextResponse.json({
        mock: true,
        tracking: {
          awb,
          current_status: "Ready to ship",
          scans: ["Order packed at Doomra workshop", "Awaiting courier pickup"],
        },
      });
    }

    const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tracking = await response.json();
    return NextResponse.json({ tracking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to track shipment." }, { status: 500 });
  }
}
