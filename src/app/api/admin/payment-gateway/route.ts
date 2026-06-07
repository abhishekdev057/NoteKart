import { NextResponse } from "next/server";
import { z } from "zod";
import { getActivePaymentGateway, setActivePaymentGateway } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { normalizePaymentGateway, paymentGatewayLabel } from "@/lib/payments";
import { requireAdmin } from "@/lib/session";

const gatewaySchema = z.object({
  gateway: z.enum(["cashfree", "phonepe", "razorpay"]),
});

export async function GET() {
  try {
    await requireAdmin();
    const gateway = await getActivePaymentGateway();
    return NextResponse.json({ gateway, label: paymentGatewayLabel(gateway) });
  } catch (error) {
    return errorResponse(error, "Unable to load payment gateway.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const input = gatewaySchema.parse(await request.json());
    const gateway = normalizePaymentGateway(input.gateway);
    await setActivePaymentGateway(gateway);
    return NextResponse.json({ gateway, label: paymentGatewayLabel(gateway) });
  } catch (error) {
    return errorResponse(error, "Unable to update payment gateway.");
  }
}
