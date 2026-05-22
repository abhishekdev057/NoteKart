import { NextResponse } from "next/server";
import { createCustomRequest, listCustomRequests } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json({ requests: await listCustomRequests() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load requests." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = await createCustomRequest({
      customerName: String(body.customerName ?? "Customer"),
      mobile: String(body.mobile ?? ""),
      notes: String(body.notes ?? ""),
      quantity: Number(body.quantity ?? 1),
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create request." }, { status: 500 });
  }
}
