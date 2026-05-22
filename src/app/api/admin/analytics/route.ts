import { NextResponse } from "next/server";
import { getAnalytics } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await getAnalytics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load analytics." }, { status: 500 });
  }
}
