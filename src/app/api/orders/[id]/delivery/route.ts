import { NextResponse } from "next/server";
import { updateOrderDelivery } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deliverySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function PATCH(request: Request, context: RouteContext<"/api/orders/[id]/delivery">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const input = deliverySchema.parse(await request.json());

    await updateOrderDelivery(id, {
      deliveryProvider: input.provider,
      deliveryTrackingNumber: input.trackingNumber ?? null,
      deliveryStatus: input.deliveryStatus,
      deliveryNotes: input.deliveryNotes ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to update delivery.");
  }
}
