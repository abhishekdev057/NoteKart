import { NextResponse } from "next/server";
import { getCashfreeOrder, normalizeCashfreeState, cashfreeMessageForState } from "@/lib/cashfree";
import { getOrderByPaymentReference, updateOrderPaymentStatusByReference } from "@/lib/db";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { orderId } = await context.params;
    const order = await getOrderByPaymentReference(orderId);
    const result = await getCashfreeOrder(orderId);

    if (!result) {
      return NextResponse.json({
        mock: true,
        orderId,
        normalizedState: "PENDING",
        message: "Cashfree credentials are not configured.",
      });
    }

    const { response, data } = result;
    let normalizedState = normalizeCashfreeState(data.order_status);

    if (response.ok && order) {
      const amount = Number(data.order_amount ?? 0);
      if (normalizedState === "COMPLETED" && amount !== order.amount) {
        console.error(`[notekart] Cashfree amount mismatch for ${orderId}: confirmed ${amount} vs expected ${order.amount}`);
        await updateOrderPaymentStatusByReference(orderId, "amount_mismatch");
        normalizedState = "FAILED";
      } else {
        await updateOrderPaymentStatusByReference(orderId, normalizedState === "COMPLETED" ? "paid" : normalizedState.toLowerCase());
      }
    }

    return NextResponse.json(
      { orderId, normalizedState, message: cashfreeMessageForState(normalizedState) },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return errorResponse(error, "Unable to check Cashfree status.");
  }
}
