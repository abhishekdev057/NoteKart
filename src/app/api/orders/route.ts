import { NextResponse } from "next/server";
import { createOrder, listOrders } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json({ orders: await listOrders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = await createOrder({
      customerName: String(body.customerName ?? "Customer"),
      mobile: String(body.mobile ?? ""),
      address: String(body.address ?? ""),
      items: Array.isArray(body.items) ? body.items : [],
      amount: Number(body.amount ?? 0),
      shiprocketAwb: body.shiprocketAwb ? String(body.shiprocketAwb) : null,
      deliveryProvider: body.deliveryProvider ? body.deliveryProvider : "review",
      deliveryTrackingNumber: body.deliveryTrackingNumber ? String(body.deliveryTrackingNumber) : null,
      deliveryNotes: body.deliveryNotes ? String(body.deliveryNotes) : null,
      phonepePaymentId: body.phonepePaymentId ? String(body.phonepePaymentId) : null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create order." }, { status: 500 });
  }
}
