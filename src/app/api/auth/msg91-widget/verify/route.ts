import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/session";
import { verifyMsg91WidgetAccessToken } from "@/lib/msg91";
import { errorResponse } from "@/lib/http";

const widgetVerifySchema = z.object({
  mobile: z.string().trim().min(10),
  accessToken: z.string().trim().min(10),
});

export async function POST(request: Request) {
  try {
    const { mobile, accessToken } = widgetVerifySchema.parse(await request.json().catch(() => ({})));
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
