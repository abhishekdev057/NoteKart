import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Math.max(1, Number(body.amount ?? 0));
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({
        mock: true,
        order: {
          id: `mock_order_${Date.now()}`,
          amount: amount * 100,
          currency: "INR",
          receipt: `notekart_${Date.now()}`,
        },
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `notekart_${Date.now()}`,
      notes: { brand: "NoteKart" },
    });

    return NextResponse.json({ order, keyId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create payment order." }, { status: 500 });
  }
}
