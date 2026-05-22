import { NextResponse } from "next/server";
import { isAdminMobile, isValidOtp, normalizeMobile } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const mobile = normalizeMobile(String(body.mobile ?? ""));
  const otp = String(body.otp ?? "");

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10 digit mobile number." }, { status: 400 });
  }

  if (!isValidOtp(otp)) {
    return NextResponse.json({ error: "OTP must be four repeated digits, like 1111, 2222 or 0000." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      mobile,
      role: isAdminMobile(mobile) ? "admin" : "customer",
    },
  });
}
