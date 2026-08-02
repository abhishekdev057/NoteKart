import { NextResponse } from "next/server";
import { checkDelhiveryServiceability, extractPincode } from "@/lib/delhivery";
import { createOrder, decrementStock, deleteOrders, getProductsByIds, listOrders } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { adminDeleteManySchema, orderSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ orders: await listOrders() });
  } catch (error) {
    return errorResponse(error, "Unable to load orders.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { ids } = adminDeleteManySchema.parse(await request.json().catch(() => ({})));
    const deletedIds = await deleteOrders(Array.from(new Set(ids)));
    return NextResponse.json({ ok: true, deletedIds, deletedCount: deletedIds.length });
  } catch (error) {
    return errorResponse(error, "Unable to delete orders.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const input = orderSchema.parse(await request.json());
    const pincode = extractPincode(input.address);
    const serviceability = await checkDelhiveryServiceability(pincode);
    const selectedMethodIsServiceable = input.paymentMethod === "cod"
      ? serviceability.cod
      : serviceability.prepaid;
    if (!serviceability.serviceable || !selectedMethodIsServiceable) {
      return NextResponse.json(
        {
          error: serviceability.status === 503
            ? serviceability.message
            : input.paymentMethod === "cod"
              ? "Cash on Delivery is not available for this pincode. Choose online payment or another address."
              : "Prepaid Delhivery service is not available for this pincode. Please try another address.",
          serviceability,
        },
        { status: serviceability.status ?? 422 },
      );
    }

    // Look up real catalog prices — never trust client-supplied amounts.
    const catalog = await getProductsByIds(input.items.map((item) => item.productId));

    const lineItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: number;
      costPrice?: number;
      imageUrl?: string | null;
      customArtworkUrl?: string | null;
      customCoverName?: string | null;
      customNotes?: string | null;
    }> = [];
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
      lineItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        costPrice: product.costPrice ?? 0,
        imageUrl: item.customArtworkUrl ?? product.images[0] ?? null,
        customArtworkUrl: item.customArtworkUrl ?? null,
        customCoverName: item.customCoverName ?? null,
        customNotes: item.customNotes ?? null,
      });
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
      paymentGateway: input.paymentMethod === "cod" ? "cod" : undefined,
      paymentStatus: input.paymentMethod === "cod" ? "cod_pending" : "pending",
      deliveryStatus: "pending",
    });

    return NextResponse.json({ id, amount, paymentMethod: input.paymentMethod });
  } catch (error) {
    return errorResponse(error, "Unable to create order.");
  }
}
