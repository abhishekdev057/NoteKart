import { NextResponse } from "next/server";
import { trackDelhiveryShipment } from "@/lib/delhivery";
import { requireAdmin } from "@/lib/session";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { waybill } = await request.json();
    if (!waybill) {
      return NextResponse.json({ error: "Waybill is required." }, { status: 400 });
    }
    const result = await trackDelhiveryShipment(String(waybill));
    return NextResponse.json(result, { status: result.ok === false ? result.status ?? 502 : 200 });
  } catch (error) {
    return errorResponse(error, "Unable to track Delhivery shipment.");
  }
}
