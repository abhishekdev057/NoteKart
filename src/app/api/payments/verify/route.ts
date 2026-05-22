import crypto from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return NextResponse.json({ verified: true, mock: true });
  }

  const payload = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return NextResponse.json({ verified: expected === body.razorpay_signature });
}
