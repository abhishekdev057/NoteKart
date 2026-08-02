import { NextResponse } from "next/server";
import { consumeRateLimit, createCustomRequest, deleteCustomRequests, listCustomRequests } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { adminDeleteManySchema, customRequestSchema } from "@/lib/validation";
import { clientIp, errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ requests: await listCustomRequests() });
  } catch (error) {
    return errorResponse(error, "Unable to load requests.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { ids } = adminDeleteManySchema.parse(await request.json().catch(() => ({})));
    const deletedIds = await deleteCustomRequests(Array.from(new Set(ids)));
    return NextResponse.json({ ok: true, deletedIds, deletedCount: deletedIds.length });
  } catch (error) {
    return errorResponse(error, "Unable to delete custom requests.");
  }
}

export async function POST(request: Request) {
  try {
    // Public lead form — rate limit to prevent spam.
    const allowed = await consumeRateLimit(`custom:${clientIp(request)}`, 10, 3600);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const input = customRequestSchema.parse(await request.json());
    const id = await createCustomRequest({
      customerName: input.customerName,
      mobile: input.mobile,
      notes: input.notes,
      quantity: input.quantity,
      imageUrl: input.imageUrl ?? null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return errorResponse(error, "Unable to create request.");
  }
}
