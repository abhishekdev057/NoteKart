import { NextResponse } from "next/server";
import { isAdminMobile } from "@/lib/auth";
import { requestOtp } from "@/lib/otp";
import { otpRequestSchema } from "@/lib/validation";
import { clientIp, errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { mobile, purpose } = otpRequestSchema.parse(await request.json().catch(() => ({})));

    if (purpose === "admin" && !isAdminMobile(mobile)) {
      return NextResponse.json(
        { error: "This mobile number is not registered as an admin.", redirect: "/" },
        { status: 403 },
      );
    }

    const result = await requestOtp(mobile, clientIp(request));

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      message: "OTP sent to your mobile number.",
    });
  } catch (error) {
    return errorResponse(error, "Unable to send OTP.");
  }
}
