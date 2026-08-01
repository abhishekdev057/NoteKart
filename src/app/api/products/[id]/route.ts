import { NextResponse } from "next/server";
import { deleteProduct, upsertProduct } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { productSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function PUT(request: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const input = productSchema.parse(await request.json());
    await upsertProduct({
      id,
      name: input.name,
      slug: input.slug || slugify(input.name),
      category: input.category,
      price: input.price,
      costPrice: input.costPrice,
      compareAtPrice: input.compareAtPrice ?? null,
      stock: input.stock,
      description: input.description,
      specs: input.specs,
      images: input.images,
      isCustomizable: input.isCustomizable,
      isFeatured: input.isFeatured,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to update product.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Unable to delete product.");
  }
}
