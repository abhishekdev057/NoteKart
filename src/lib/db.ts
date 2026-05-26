import { neon } from "@neondatabase/serverless";
import type { CustomRequest, Order, Product } from "./types";

type SqlClient = ReturnType<typeof neon>;
type DbRow = Record<string, unknown>;

let sqlClient: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

const seedProducts: Product[] = [
  {
    id: "classic-a5-hardbound",
    name: "Classic A5 Hardbound Notebook",
    slug: "classic-a5-hardbound",
    category: "Hardbound",
    price: 249,
    compareAtPrice: 320,
    stock: 180,
    description: "A durable daily notebook with smooth ruled pages and a premium wraparound cover.",
    specs: { Size: "A5", Pages: "192", Paper: "80 GSM", Binding: "Hardbound" },
    images: [
      "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1200&q=80",
    ],
    isCustomizable: true,
    isFeatured: true,
  },
  {
    id: "spiral-campus-pack",
    name: "Spiral Campus Pack",
    slug: "spiral-campus-pack",
    category: "Spiral",
    price: 129,
    compareAtPrice: 160,
    stock: 260,
    description: "Lightweight spiral notebooks for school, coaching and everyday class notes.",
    specs: { Size: "A4", Pages: "160", Paper: "70 GSM", Binding: "Spiral" },
    images: [
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
    ],
    isCustomizable: false,
    isFeatured: true,
  },
  {
    id: "custom-photo-journal",
    name: "Custom Photo Journal",
    slug: "custom-photo-journal",
    category: "Customized",
    price: 399,
    compareAtPrice: 499,
    stock: 75,
    description: "Upload a photo, logo or artwork and turn it into a polished personal notebook cover.",
    specs: { Size: "A5 / A4", Pages: "120-240", Finish: "Matte or Gloss", MOQ: "1 piece" },
    images: [
      "https://images.unsplash.com/photo-1516796181074-bf453fbfa3e6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=1200&q=80",
    ],
    isCustomizable: true,
    isFeatured: true,
  },
];

function getSql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured.");
    sqlClient = neon(url);
  }
  return sqlClient;
}

async function ensureSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      compare_at_price INTEGER,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      specs JSONB NOT NULL DEFAULT '{}'::jsonb,
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_customizable BOOLEAN NOT NULL DEFAULT false,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS custom_requests (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      notes TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      address TEXT NOT NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      amount INTEGER NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      delivery_status TEXT NOT NULL DEFAULT 'draft',
      shiprocket_awb TEXT,
      phonepe_payment_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS phonepe_payment_id TEXT`;

  const count = (await sql`SELECT COUNT(*)::int AS count FROM products`) as DbRow[];
  if (Number(count[0]?.count ?? 0) === 0) {
    for (const product of seedProducts) {
      await writeProduct(product);
    }
  }
}

export async function readyDb() {
  schemaReady ??= ensureSchema();
  await schemaReady;
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    category: String(row.category),
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    stock: Number(row.stock),
    description: String(row.description),
    specs: (row.specs as Record<string, string>) ?? {},
    images: (row.images as string[]) ?? [],
    isCustomizable: Boolean(row.is_customizable),
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function listProducts() {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM products ORDER BY is_featured DESC, created_at DESC`) as DbRow[];
  return rows.map(rowToProduct);
}

export async function upsertProduct(product: Product) {
  await readyDb();
  await writeProduct(product);
}

async function writeProduct(product: Product) {
  const sql = getSql();
  await sql`
    INSERT INTO products (
      id, name, slug, category, price, compare_at_price, stock, description, specs, images, is_customizable, is_featured
    ) VALUES (
      ${product.id}, ${product.name}, ${product.slug}, ${product.category}, ${product.price},
      ${product.compareAtPrice ?? null}, ${product.stock}, ${product.description}, ${JSON.stringify(product.specs)}::jsonb,
      ${JSON.stringify(product.images)}::jsonb, ${product.isCustomizable}, ${product.isFeatured}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      category = EXCLUDED.category,
      price = EXCLUDED.price,
      compare_at_price = EXCLUDED.compare_at_price,
      stock = EXCLUDED.stock,
      description = EXCLUDED.description,
      specs = EXCLUDED.specs,
      images = EXCLUDED.images,
      is_customizable = EXCLUDED.is_customizable,
      is_featured = EXCLUDED.is_featured
  `;
}

export async function deleteProduct(id: string) {
  await readyDb();
  await getSql()`DELETE FROM products WHERE id = ${id}`;
}

export async function createCustomRequest(request: Omit<CustomRequest, "id" | "status" | "createdAt">) {
  await readyDb();
  const id = crypto.randomUUID();
  await getSql()`
    INSERT INTO custom_requests (id, customer_name, mobile, notes, quantity, image_url)
    VALUES (${id}, ${request.customerName}, ${request.mobile}, ${request.notes}, ${request.quantity}, ${request.imageUrl ?? null})
  `;
  return id;
}

export async function listCustomRequests() {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM custom_requests ORDER BY created_at DESC`) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    customerName: String(row.customer_name),
    mobile: String(row.mobile),
    notes: String(row.notes),
    quantity: Number(row.quantity),
    imageUrl: row.image_url ? String(row.image_url) : null,
    status: String(row.status),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  })) satisfies CustomRequest[];
}

export async function createOrder(order: Omit<Order, "id" | "paymentStatus" | "deliveryStatus" | "createdAt">) {
  await readyDb();
  const id = crypto.randomUUID();
  await getSql()`
    INSERT INTO orders (id, customer_name, mobile, address, items, amount, shiprocket_awb, phonepe_payment_id)
    VALUES (${id}, ${order.customerName}, ${order.mobile}, ${order.address}, ${JSON.stringify(order.items)}::jsonb, ${order.amount}, ${order.shiprocketAwb ?? null}, ${order.phonepePaymentId ?? null})
  `;
  return id;
}

export async function listOrders() {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders ORDER BY created_at DESC`) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    customerName: String(row.customer_name),
    mobile: String(row.mobile),
    address: String(row.address),
    items: (row.items as Order["items"]) ?? [],
    amount: Number(row.amount),
    paymentStatus: String(row.payment_status),
    deliveryStatus: String(row.delivery_status),
    shiprocketAwb: row.shiprocket_awb ? String(row.shiprocket_awb) : null,
    phonepePaymentId: row.phonepe_payment_id ? String(row.phonepe_payment_id) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  })) satisfies Order[];
}

export async function updateOrderPaymentStatusByPhonePe(phonepePaymentId: string, paymentStatus: string) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET payment_status = ${paymentStatus}
    WHERE phonepe_payment_id = ${phonepePaymentId}
  `;
}

export async function getAnalytics() {
  await readyDb();
  const sql = getSql();
  const [products, custom, orders, revenue] = (await Promise.all([
    sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(stock), 0)::int AS stock FROM products`,
    sql`SELECT COUNT(*)::int AS count FROM custom_requests`,
    sql`SELECT COUNT(*)::int AS count FROM orders`,
    sql`SELECT COALESCE(SUM(amount), 0)::int AS amount FROM orders`,
  ])) as DbRow[][];

  return {
    productCount: Number(products[0]?.count ?? 0),
    stock: Number(products[0]?.stock ?? 0),
    customRequestCount: Number(custom[0]?.count ?? 0),
    orderCount: Number(orders[0]?.count ?? 0),
    revenue: Number(revenue[0]?.amount ?? 0),
  };
}
