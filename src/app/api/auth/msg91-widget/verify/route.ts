import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminMobile } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { verifyMsg91WidgetAccessToken } from "@/lib/msg91";
import { errorResponse } from "@/lib/http";

const widgetVerifySchema = z.object({
  mobile: z.string().trim().min(10),
  accessToken: z.string().trim().min(10),
  purpose: z.enum(["customer", "admin"]).default("customer"),
});

export async function POST(request: Request) {
  try {
    const { mobile, accessToken, purpose } = widgetVerifySchema.parse(await request.json().catch(() => ({})));

    if (purpose === "admin" && !isAdminMobile(mobile)) {
      return NextResponse.json(
        { error: "This mobile number is not registered as an admin.", redirect: "/" },
        { status: 403 },
      );
    }

    const verified = await verifyMsg91WidgetAccessToken(accessToken, mobile);

    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }

    const user = await createSession(verified.mobile);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error, "Unable to verify MSG91 login.");
  }
}
