import { NextResponse } from "next/server";
import { deleteOrders } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

export async function DELETE(_request: Request, context: RouteContext<"/api/orders/[id]">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const deletedIds = await deleteOrders([id]);
    if (!deletedIds.length) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deletedIds, deletedCount: 1 });
  } catch (error) {
    return errorResponse(error, "Unable to delete order.");
  }
}
