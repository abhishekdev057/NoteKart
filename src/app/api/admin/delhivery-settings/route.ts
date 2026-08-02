import { NextResponse } from "next/server";
import { getDelhiverySettings, setDelhiverySettings } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { delhiverySettingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ settings: await getDelhiverySettings() });
  } catch (error) {
    return errorResponse(error, "Unable to load Delhivery settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const settings = delhiverySettingsSchema.parse(await request.json());
    await setDelhiverySettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return errorResponse(error, "Unable to update Delhivery settings.");
  }
}
