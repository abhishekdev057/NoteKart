import { NextResponse } from "next/server";
import { listOrdersByMobile } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireUser();
    const orders = await listOrdersByMobile(session.mobile);
    return NextResponse.json({ orders });
  } catch (error) {
    return errorResponse(error, "Unable to load your orders.");
  }
}
