import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCashfreeOrder } from "@/lib/cashfree";
import { getActivePaymentGateway, getOrderById, setOrderPaymentReference, setOrderPhonePeId } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { paymentGatewayLabel, siteUrl } from "@/lib/payments";
import { getPhonePeAccessToken, getPhonePeBaseUrl } from "@/lib/phonepe";
import { requireUser } from "@/lib/session";

const paySchema = z.object({ orderId: z.string().trim().min(1) });

async function createPhonePePayment(orderId: string, amount: number, mobile: string) {
  const merchantOrderId = `nk_${randomUUID().replace(/-/g, "")}`;
  const amountPaise = amount * 100;
  const redirectUrl = `${siteUrl()}/payment/phonepe/redirect?merchantOrderId=${merchantOrderId}`;
  const accessToken = await getPhonePeAccessToken();
  await setOrderPhonePeId(orderId, merchantOrderId);

  if (!accessToken) {
    return {
      mock: true,
      gateway: "phonepe",
      paymentReference: merchantOrderId,
      redirectUrl: null,
      message: "PhonePe credentials are not configured.",
    };
  }

  const response = await fetch(`${getPhonePeBaseUrl()}/checkout/v2/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${accessToken}` },
    body: JSON.stringify({
      merchantOrderId,
      amount: amountPaise,
      expireAfter: 1200,
      metaInfo: { udf1: "NoteKart", udf2: mobile },
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "NoteKart notebook order payment",
        merchantUrls: { redirectUrl },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      error: typeof data?.message === "string" ? data.message : "Unable to create PhonePe payment.",
      status: response.status,
    };
  }

  const paymentUrl =
    data.redirectUrl ??
    data.data?.redirectUrl ??
    data.data?.paymentUrl ??
    data.data?.instrumentResponse?.redirectInfo?.url ??
    data.url ??
    null;

  return { gateway: "phonepe", paymentReference: merchantOrderId, redirectUrl: paymentUrl };
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
    if (order.paymentGateway === "cod") {
      return NextResponse.json({ error: "This Cash on Delivery order is already confirmed." }, { status: 409 });
    }

    const gateway = await getActivePaymentGateway();

    if (gateway === "cashfree") {
      const payment = await createCashfreeOrder(order, session.mobile);
      if ("error" in payment) {
        return NextResponse.json({ error: payment.error }, { status: payment.status });
      }
      if (!payment.mock && !payment.paymentSessionId) {
        return NextResponse.json({ error: "Cashfree did not return a payment session. Please retry checkout." }, { status: 502 });
      }
      await setOrderPaymentReference(order.id, "cashfree", payment.orderId);
      return NextResponse.json({
        gateway,
        label: paymentGatewayLabel(gateway),
        paymentReference: payment.orderId,
        paymentSessionId: payment.paymentSessionId,
        mode: payment.mode,
        mock: payment.mock ?? false,
        message: payment.message,
      });
    }

    if (gateway === "phonepe") {
      const payment = await createPhonePePayment(order.id, order.amount, session.mobile);
      if ("error" in payment) {
        return NextResponse.json({ error: payment.error }, { status: payment.status });
      }
      return NextResponse.json({ label: paymentGatewayLabel(gateway), ...payment });
    }

    return NextResponse.json(
      {
        error:
          "Razorpay is selectable in admin, but live Razorpay credentials and checkout have not been configured yet. Switch to Cashfree or PhonePe to accept payments.",
      },
      { status: 409 },
    );
  } catch (error) {
    return errorResponse(error, "Unable to create payment.");
  }
}
