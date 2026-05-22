import { Storefront } from "@/components/Storefront";
import { listProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listProducts();
  return <Storefront products={products} />;
}
