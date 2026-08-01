import { NextResponse } from "next/server";
import { isAdminMobile } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { otpVerifySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { mobile, code, purpose } = otpVerifySchema.parse(await request.json().catch(() => ({})));

    if (purpose === "admin" && !isAdminMobile(mobile)) {
      return NextResponse.json(
        { error: "This mobile number is not registered as an admin.", redirect: "/" },
        { status: 403 },
      );
    }

    const result = await verifyOtp(mobile, code);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const user = await createSession(mobile);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error, "Unable to verify OTP.");
  }
}
