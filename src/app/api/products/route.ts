import { NextResponse } from "next/server";
import { listProducts, upsertProduct } from "@/lib/db";
import type { Product } from "@/lib/types";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    return NextResponse.json({ products: await listProducts() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load products." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "Untitled Notebook");
    const id = String(body.id ?? crypto.randomUUID());
    const product: Product = {
      id,
      name,
      slug: String(body.slug ?? slugify(name)),
      category: String(body.category ?? "Notebooks"),
      price: Number(body.price ?? 0),
      compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
      stock: Number(body.stock ?? 0),
      description: String(body.description ?? ""),
      specs: body.specs && typeof body.specs === "object" ? body.specs : {},
      images: Array.isArray(body.images) ? body.images : [],
      isCustomizable: Boolean(body.isCustomizable),
      isFeatured: Boolean(body.isFeatured),
    };

    await upsertProduct(product);
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save product." }, { status: 500 });
  }
}
