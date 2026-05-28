import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderById, setOrderPhonePeId } from "@/lib/db";
import { getPhonePeAccessToken, getPhonePeBaseUrl } from "@/lib/phonepe";
import { requireUser } from "@/lib/session";
import { errorResponse } from "@/lib/http";

const paySchema = z.object({ orderId: z.string().trim().min(1) });

function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const { orderId } = paySchema.parse(await request.json());

    const order = await getOrderById(orderId);
    if (!order || order.mobile !== session.mobile) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    }

    // Unguessable, unique-per-attempt reference. Amount comes from the stored
    // order, never from the client.
    const merchantOrderId = `nk_${randomUUID().replace(/-/g, "")}`;
    const amountPaise = order.amount * 100;
    const redirectUrl = `${siteUrl()}/payment/phonepe/redirect?merchantOrderId=${merchantOrderId}`;

    const accessToken = await getPhonePeAccessToken();
    await setOrderPhonePeId(order.id, merchantOrderId);

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
      headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${accessToken}` },
      body: JSON.stringify({
        merchantOrderId,
        amount: amountPaise,
        expireAfter: 1200,
        metaInfo: { udf1: "NoteKart", udf2: session.mobile },
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "NoteKart notebook order payment",
          merchantUrls: { redirectUrl },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data?.message === "string" ? data.message : "Unable to create PhonePe payment." },
        { status: response.status },
      );
    }

    const paymentUrl =
      data.redirectUrl ??
      data.data?.redirectUrl ??
      data.data?.paymentUrl ??
      data.data?.instrumentResponse?.redirectInfo?.url ??
      data.url ??
      null;

    return NextResponse.json({ merchantOrderId, redirectUrl: paymentUrl });
  } catch (error) {
    return errorResponse(error, "Unable to create PhonePe payment.");
  }
}
