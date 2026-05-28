import { NextResponse } from "next/server";
import { consumeRateLimit, createCustomRequest, listCustomRequests } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { customRequestSchema } from "@/lib/validation";
import { clientIp, errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ requests: await listCustomRequests() });
  } catch (error) {
    return errorResponse(error, "Unable to load requests.");
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
