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
      // devCode is only ever populated outside production when no SMS provider is set.
      ...(result.devCode ? { devCode: result.devCode } : {}),
      message: result.delivered
        ? "OTP sent to your mobile number."
        : "OTP generated. Check the server console (no SMS provider configured).",
    });
  } catch (error) {
    return errorResponse(error, "Unable to send OTP.");
  }
}
