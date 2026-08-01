import { NextResponse } from "next/server";
import { listProducts, upsertProduct } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { productSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import type { Product } from "@/lib/types";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    return NextResponse.json({ products: await listProducts() });
  } catch (error) {
    return errorResponse(error, "Unable to load products.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = productSchema.parse(await request.json());

    const name = input.name;
    const product: Product = {
      id: input.id ?? crypto.randomUUID(),
      name,
      slug: input.slug || slugify(name),
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
    };

    await upsertProduct(product);
    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error, "Unable to save product.");
  }
}
