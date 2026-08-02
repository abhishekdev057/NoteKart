import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { errorResponse } from "@/lib/http";

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
    await requireAdmin();
    const { awb } = await request.json();
    const token = await getShiprocketToken();

    if (!token) {
      return NextResponse.json(
        { error: "Live Shiprocket tracking is not configured." },
        { status: 503 },
      );
    }

    const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tracking = await response.json();
    return NextResponse.json({ tracking });
  } catch (error) {
    return errorResponse(error, "Unable to track shipment.");
  }
}
