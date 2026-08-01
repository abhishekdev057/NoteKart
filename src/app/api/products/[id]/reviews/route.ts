import { NextResponse } from "next/server";
import { listProductReviews, upsertProductReview } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireUser } from "@/lib/session";
import { reviewSchema } from "@/lib/validation";

export async function GET(_request: Request, context: RouteContext<"/api/products/[id]/reviews">) {
  try {
    const { id } = await context.params;
    const reviews = await listProductReviews(id);
    const rating = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    return NextResponse.json({ reviews, rating, count: reviews.length });
  } catch (error) {
    return errorResponse(error, "Unable to load product reviews.");
  }
}

export async function POST(request: Request, context: RouteContext<"/api/products/[id]/reviews">) {
  try {
    const session = await requireUser();
    const { id: productId } = await context.params;
    const review = reviewSchema.parse(await request.json());
    const id = await upsertProductReview(productId, session.mobile, review);
    if (!id) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    return errorResponse(error, "Unable to save your review.");
  }
}
