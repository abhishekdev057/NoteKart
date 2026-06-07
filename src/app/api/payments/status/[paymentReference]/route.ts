import { NextResponse } from "next/server";
import { getOrderByPaymentReference } from "@/lib/db";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ paymentReference: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { paymentReference } = await context.params;
    const order = await getOrderByPaymentReference(paymentReference);
    if (!order) {
      return NextResponse.json({ error: "Payment reference not found." }, { status: 404 });
    }

    if (order.paymentGateway === "cashfree") {
      return NextResponse.redirect(new URL(`/api/payments/cashfree/status/${paymentReference}`, _request.url));
    }

    if (order.paymentGateway === "phonepe") {
      return NextResponse.redirect(new URL(`/api/payments/phonepe/status/${paymentReference}`, _request.url));
    }

    return NextResponse.json({
      paymentReference,
      normalizedState: order.paymentStatus === "paid" ? "COMPLETED" : "PENDING",
      message: "Razorpay status checking is not configured yet.",
    });
  } catch (error) {
    return errorResponse(error, "Unable to check payment status.");
  }
}
