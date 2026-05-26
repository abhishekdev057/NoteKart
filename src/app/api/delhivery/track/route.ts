import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { waybill } = await request.json();
    const token = process.env.DELHIVERY_API_TOKEN;
    const environment = process.env.DELHIVERY_ENV === "production" ? "production" : "test";
    const baseUrl = environment === "production" ? "https://track.delhivery.com" : "https://staging-express.delhivery.com";

    if (!waybill) {
      return NextResponse.json({ error: "Waybill is required." }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({
        mock: true,
        tracking: {
          waybill,
          current_status: "Ready for review",
          provider: "Delhivery",
          scans: ["Order packed at Doomra workshop", "Waiting for Delhivery token / AWB confirmation"],
        },
      });
    }

    const url = new URL("/api/v1/packages/json/", baseUrl);
    url.searchParams.set("waybill", String(waybill));
    url.searchParams.set("verbose", "2");

    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
    });
    const tracking = await response.json();

    return NextResponse.json({ tracking });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to track Delhivery shipment." }, { status: 500 });
  }
}
