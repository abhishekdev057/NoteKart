import { NextResponse } from "next/server";
import { checkDelhiveryServiceability } from "@/lib/delhivery";
import { errorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const pincode = new URL(request.url).searchParams.get("pincode") ?? "";
    const serviceability = await checkDelhiveryServiceability(pincode);
    return NextResponse.json(serviceability, { status: serviceability.serviceable ? 200 : serviceability.status ?? 422 });
  } catch (error) {
    return errorResponse(error, "Unable to check delivery serviceability.");
  }
}
