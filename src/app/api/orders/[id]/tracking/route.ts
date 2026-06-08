import { NextResponse } from "next/server";
import { trackDelhiveryShipment } from "@/lib/delhivery";
import { getOrderById } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireUser } from "@/lib/session";

export async function GET(_request: Request, context: RouteContext<"/api/orders/[id]/tracking">) {
  try {
    const session = await requireUser();
    const { id } = await context.params;
    const order = await getOrderById(id);

    if (!order || order.mobile !== session.mobile) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.deliveryProvider !== "delhivery" || !order.deliveryTrackingNumber) {
      return NextResponse.json({ error: "Delhivery tracking is not assigned for this order yet." }, { status: 409 });
    }

    const result = await trackDelhiveryShipment(order.deliveryTrackingNumber);
    return NextResponse.json(result, { status: result.ok === false ? result.status ?? 502 : 200 });
  } catch (error) {
    return errorResponse(error, "Unable to load delivery tracking.");
  }
}
