import { NextResponse } from "next/server";
import { createDelhiveryShipment } from "@/lib/delhivery";
import { getOrderById, updateOrderDelivery } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { deliverySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function PATCH(request: Request, context: RouteContext<"/api/orders/[id]/delivery">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const input = deliverySchema.parse(await request.json());
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    let trackingNumber = input.trackingNumber ?? null;
    let deliveryStatus = input.deliveryStatus;
    let deliveryNotes = input.deliveryNotes ?? null;

    if (input.provider === "delhivery" && !trackingNumber) {
      if (order.paymentStatus !== "paid" && order.paymentGateway !== "cod") {
        return NextResponse.json(
          { error: "Delhivery shipment can be created only after payment is successful." },
          { status: 409 },
        );
      }
      const shipment = await createDelhiveryShipment(order);
      if (!shipment.ok || !shipment.waybill) {
        return NextResponse.json({ error: shipment.error, serviceability: shipment.serviceability }, { status: 422 });
      }
      trackingNumber = shipment.waybill;
      deliveryStatus = "shipped";
      deliveryNotes = [deliveryNotes, shipment.message ?? "Delhivery AWB generated automatically."]
        .filter(Boolean)
        .join("\n");
    }

    await updateOrderDelivery(id, {
      deliveryProvider: input.provider,
      deliveryTrackingNumber: trackingNumber,
      deliveryStatus,
      deliveryNotes,
    });

    return NextResponse.json({ ok: true, trackingNumber, deliveryStatus, deliveryNotes });
  } catch (error) {
    return errorResponse(error, "Unable to update delivery.");
  }
}
