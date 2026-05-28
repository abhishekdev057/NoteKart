import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { otpVerifySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const { mobile, code } = otpVerifySchema.parse(await request.json().catch(() => ({})));
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
