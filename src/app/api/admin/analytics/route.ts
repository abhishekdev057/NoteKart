import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAnalytics());
  } catch (error) {
    return errorResponse(error, "Unable to load analytics.");
  }
}
