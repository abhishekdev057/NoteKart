import { NextResponse } from "next/server";
import { isAdminMobile } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { otpRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { mobile } = otpRequestSchema.parse({
      ...(await request.json().catch(() => ({}))),
      purpose: "admin",
    });

    if (!isAdminMobile(mobile)) {
      return NextResponse.json(
        { error: "This mobile number is not registered as an admin.", redirect: "/" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to check admin access.");
  }
}
