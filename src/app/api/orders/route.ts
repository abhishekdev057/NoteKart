import { NextResponse } from "next/server";
import { createOrder, decrementStock, getProductsByIds, listOrders } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { orderSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ orders: await listOrders() });
  } catch (error) {
    return errorResponse(error, "Unable to load orders.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const input = orderSchema.parse(await request.json());

    // Look up real catalog prices — never trust client-supplied amounts.
    const catalog = await getProductsByIds(input.items.map((item) => item.productId));

    const lineItems: Array<{ productId: string; name: string; quantity: number; price: number }> = [];
    for (const item of input.items) {
      const product = catalog.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product no longer available.` }, { status: 409 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Only ${product.stock} left of ${product.name}.` },
          { status: 409 },
        );
      }
      lineItems.push({ productId: product.id, name: product.name, quantity: item.quantity, price: product.price });
    }

    const amount = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Reserve stock with guarded decrements; compensate if any line runs short
    // (the http driver has no multi-statement transaction, so this is the
    // pragmatic equivalent of a reservation).
    const reserved: Array<{ productId: string; quantity: number }> = [];
    for (const item of lineItems) {
      const ok = await decrementStock(item.productId, item.quantity);
      if (!ok) {
        await Promise.all(reserved.map((r) => decrementStock(r.productId, -r.quantity)));
        return NextResponse.json({ error: "Stock changed during checkout. Please retry." }, { status: 409 });
      }
      reserved.push({ productId: item.productId, quantity: item.quantity });
    }

    const id = await createOrder({
      customerName: input.customerName,
      mobile: session.mobile,
      address: input.address,
      items: lineItems,
      amount,
    });

    return NextResponse.json({ id, amount });
  } catch (error) {
    return errorResponse(error, "Unable to create order.");
  }
}
