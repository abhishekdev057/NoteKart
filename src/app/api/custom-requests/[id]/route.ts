import { NextResponse } from "next/server";
import { deleteCustomRequests } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireAdmin } from "@/lib/session";

export async function DELETE(_request: Request, context: RouteContext<"/api/custom-requests/[id]">) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const deletedIds = await deleteCustomRequests([id]);
    if (!deletedIds.length) {
      return NextResponse.json({ error: "Custom request not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deletedIds, deletedCount: 1 });
  } catch (error) {
    return errorResponse(error, "Unable to delete custom request.");
  }
}
