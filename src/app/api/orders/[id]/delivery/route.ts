import { NextResponse } from "next/server";
import { updateOrderDelivery } from "@/lib/db";
import type { DeliveryProvider } from "@/lib/types";

const providers = new Set<DeliveryProvider>(["review", "delhivery", "post_office", "manual"]);

export async function PATCH(request: Request, context: RouteContext<"/api/orders/[id]/delivery">) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const provider = providers.has(body.provider) ? body.provider : "review";

    await updateOrderDelivery(id, {
      deliveryProvider: provider,
      deliveryTrackingNumber: body.trackingNumber ? String(body.trackingNumber) : null,
      deliveryStatus: body.deliveryStatus ? String(body.deliveryStatus) : "review",
      deliveryNotes: body.deliveryNotes ? String(body.deliveryNotes) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update delivery." }, { status: 500 });
  }
}
