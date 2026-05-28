import { NextResponse } from "next/server";
import { getOrderByPhonePeId, updateOrderPaymentStatusByPhonePe } from "@/lib/db";
import {
  extractPhonePeAmount,
  getPhonePeAccessToken,
  getPhonePeBaseUrl,
  normalizePhonePeState,
  userMessageForState,
} from "@/lib/phonepe";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ merchantOrderId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { merchantOrderId } = await context.params;
    const order = await getOrderByPhonePeId(merchantOrderId);
    const accessToken = await getPhonePeAccessToken();

    if (!accessToken) {
      return NextResponse.json({
        mock: true,
        merchantOrderId,
        normalizedState: "PENDING",
        message: "PhonePe credentials are not configured.",
      });
    }

    const response = await fetch(`${getPhonePeBaseUrl()}/checkout/v2/order/${merchantOrderId}/status`, {
      headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${accessToken}` },
    });
    const data = await response.json();
    let normalizedState = normalizePhonePeState(data);

    if (response.ok && order) {
      if (normalizedState === "COMPLETED") {
        // Defend against tampering: only mark paid when the amount PhonePe
        // confirmed matches the amount we computed server-side for the order.
        const confirmed = extractPhonePeAmount(data);
        if (confirmed !== null && confirmed !== order.amount * 100) {
          console.error(
            `[notekart] PhonePe amount mismatch for ${merchantOrderId}: confirmed ${confirmed} vs expected ${order.amount * 100}`,
          );
          await updateOrderPaymentStatusByPhonePe(merchantOrderId, "amount_mismatch");
          normalizedState = "FAILED";
        } else {
          await updateOrderPaymentStatusByPhonePe(merchantOrderId, "paid");
        }
      } else {
        await updateOrderPaymentStatusByPhonePe(merchantOrderId, normalizedState.toLowerCase());
      }
    }

    // Only expose the normalized state and a friendly message — never the raw
    // PhonePe payload (which can contain instrument/customer detail).
    return NextResponse.json(
      { merchantOrderId, normalizedState, message: userMessageForState(normalizedState) },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return errorResponse(error, "Unable to check PhonePe status.");
  }
}
