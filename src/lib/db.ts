import { neon } from "@neondatabase/serverless";
import { normalizePaymentGateway } from "./payments";
import type { CustomRequest, Order, PaymentGateway, Product, ProductReview } from "./types";

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
    costPrice: 145,
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
    costPrice: 72,
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
    name: "A4 Custom Photo Album",
    slug: "custom-photo-journal",
    category: "Customized",
    price: 199,
    costPrice: 110,
    compareAtPrice: 249,
    stock: 75,
    description: "A4 custom photo album with your cover photo and optional printed name.",
    specs: { Size: "A4", Pages: "120-240", Finish: "Matte or Gloss", MOQ: "1 piece" },
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
      cost_price INTEGER NOT NULL DEFAULT 0,
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
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER NOT NULL DEFAULT 0`;

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
      delivery_status TEXT NOT NULL DEFAULT 'pending',
      shiprocket_awb TEXT,
      delivery_provider TEXT NOT NULL DEFAULT 'review',
      delivery_tracking_number TEXT,
      delivery_notes TEXT,
      payment_gateway TEXT NOT NULL DEFAULT 'cashfree',
      payment_reference TEXT,
      phonepe_payment_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS phonepe_payment_id TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT NOT NULL DEFAULT 'cashfree'`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider TEXT NOT NULL DEFAULT 'review'`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tracking_number TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(product_id, mobile)
    )
  `;

  // Remove exactly the 132 legacy custom requests once on the first production
  // startup after this release. The marker makes the cleanup idempotent.
  await sql`
    WITH cleanup_marker AS (
      INSERT INTO site_settings (key, value)
      VALUES ('legacy_custom_requests_132_removed', 'true')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    ), old_requests AS (
      SELECT id FROM custom_requests ORDER BY created_at ASC LIMIT 132
    )
    DELETE FROM custom_requests request
    USING old_requests, cleanup_marker
    WHERE request.id = old_requests.id
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS otp_codes (
      mobile TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

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
    costPrice: Number(row.cost_price ?? 0),
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
  if (!process.env.DATABASE_URL) return seedProducts;
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
      id, name, slug, category, price, cost_price, compare_at_price, stock, description, specs, images, is_customizable, is_featured
    ) VALUES (
      ${product.id}, ${product.name}, ${product.slug}, ${product.category}, ${product.price}, ${product.costPrice ?? 0},
      ${product.compareAtPrice ?? null}, ${product.stock}, ${product.description}, ${JSON.stringify(product.specs)}::jsonb,
      ${JSON.stringify(product.images)}::jsonb, ${product.isCustomizable}, ${product.isFeatured}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      category = EXCLUDED.category,
      price = EXCLUDED.price,
      cost_price = EXCLUDED.cost_price,
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

type NewOrder = Omit<Order, "id" | "paymentStatus" | "deliveryStatus" | "createdAt"> & {
  paymentStatus?: string;
  deliveryStatus?: string;
};

export async function createOrder(order: NewOrder) {
  await readyDb();
  const id = crypto.randomUUID();
  await getSql()`
    INSERT INTO orders (
      id, customer_name, mobile, address, items, amount, payment_status, delivery_status, shiprocket_awb,
      delivery_provider, delivery_tracking_number, delivery_notes, payment_gateway, payment_reference, phonepe_payment_id
    )
    VALUES (
      ${id}, ${order.customerName}, ${order.mobile}, ${order.address}, ${JSON.stringify(order.items)}::jsonb,
      ${order.amount}, ${order.paymentStatus ?? "pending"}, ${order.deliveryStatus ?? "pending"},
      ${order.shiprocketAwb ?? null}, ${order.deliveryProvider ?? "review"},
      ${order.deliveryTrackingNumber ?? null}, ${order.deliveryNotes ?? null},
      ${order.paymentGateway ?? "cashfree"}, ${order.paymentReference ?? null}, ${order.phonepePaymentId ?? null}
    )
  `;
  return id;
}

function rowToOrder(row: DbRow): Order {
  return {
    id: String(row.id),
    customerName: String(row.customer_name),
    mobile: String(row.mobile),
    address: String(row.address),
    items: (row.items as Order["items"]) ?? [],
    amount: Number(row.amount),
    paymentStatus: String(row.payment_status),
    deliveryStatus: String(row.delivery_status),
    shiprocketAwb: row.shiprocket_awb ? String(row.shiprocket_awb) : null,
    deliveryProvider: row.delivery_provider ? (String(row.delivery_provider) as Order["deliveryProvider"]) : "review",
    deliveryTrackingNumber: row.delivery_tracking_number ? String(row.delivery_tracking_number) : null,
    deliveryNotes: row.delivery_notes ? String(row.delivery_notes) : null,
    paymentGateway: row.payment_gateway === "cod" ? "cod" : row.payment_gateway ? normalizePaymentGateway(row.payment_gateway) : "cashfree",
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    phonepePaymentId: row.phonepe_payment_id ? String(row.phonepe_payment_id) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function listOrders() {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders ORDER BY created_at DESC`) as DbRow[];
  return rows.map(rowToOrder);
}

export async function listOrdersByMobile(mobile: string) {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders WHERE mobile = ${mobile} ORDER BY created_at DESC`) as DbRow[];
  return rows.map(rowToOrder);
}

export async function updateOrderDelivery(
  id: string,
  delivery: Pick<Order, "deliveryProvider" | "deliveryTrackingNumber" | "deliveryStatus" | "deliveryNotes">,
) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET
      delivery_provider = ${delivery.deliveryProvider ?? "review"},
      delivery_tracking_number = ${delivery.deliveryTrackingNumber ?? null},
      delivery_status = ${delivery.deliveryStatus ?? "pending"},
      delivery_notes = ${delivery.deliveryNotes ?? null}
    WHERE id = ${id}
  `;
}

export async function updateOrderPaymentStatusByPhonePe(phonepePaymentId: string, paymentStatus: string) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET payment_status = ${paymentStatus}, payment_gateway = 'phonepe', payment_reference = ${phonepePaymentId}
    WHERE phonepe_payment_id = ${phonepePaymentId}
  `;
}

export async function updateOrderPaymentStatusByReference(paymentReference: string, paymentStatus: string) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET payment_status = ${paymentStatus}
    WHERE payment_reference = ${paymentReference}
  `;
}

export async function getProductsByIds(ids: string[]) {
  await readyDb();
  if (!ids.length) return new Map<string, Product>();
  const rows = (await getSql()`SELECT * FROM products WHERE id = ANY(${ids})`) as DbRow[];
  return new Map(rows.map(rowToProduct).map((product) => [product.id, product]));
}

export async function getOrderById(id: string) {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders WHERE id = ${id} LIMIT 1`) as DbRow[];
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function getOrderByPhonePeId(phonepePaymentId: string) {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders WHERE phonepe_payment_id = ${phonepePaymentId} LIMIT 1`) as DbRow[];
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function getOrderByPaymentReference(paymentReference: string) {
  await readyDb();
  const rows = (await getSql()`SELECT * FROM orders WHERE payment_reference = ${paymentReference} LIMIT 1`) as DbRow[];
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function setOrderPhonePeId(id: string, phonepePaymentId: string) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET phonepe_payment_id = ${phonepePaymentId}, payment_gateway = 'phonepe', payment_reference = ${phonepePaymentId}
    WHERE id = ${id}
  `;
}

export async function setOrderPaymentReference(id: string, paymentGateway: PaymentGateway, paymentReference: string) {
  await readyDb();
  await getSql()`
    UPDATE orders
    SET payment_gateway = ${paymentGateway}, payment_reference = ${paymentReference}
    WHERE id = ${id}
  `;
}

export async function getActivePaymentGateway() {
  await readyDb();
  const rows = (await getSql()`SELECT value FROM site_settings WHERE key = 'payment_gateway' LIMIT 1`) as DbRow[];
  return normalizePaymentGateway(rows[0]?.value ?? process.env.PAYMENT_GATEWAY);
}

export async function setActivePaymentGateway(paymentGateway: PaymentGateway) {
  await readyDb();
  await getSql()`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('payment_gateway', ${paymentGateway}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function listProductReviews(productId: string) {
  if (!process.env.DATABASE_URL) return [];
  await readyDb();
  const rows = (await getSql()`
    SELECT id, product_id, customer_name, rating, title, comment, is_verified_purchase, created_at
    FROM product_reviews
    WHERE product_id = ${productId}
    ORDER BY created_at DESC
  `) as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    productId: String(row.product_id),
    customerName: String(row.customer_name),
    rating: Number(row.rating),
    title: String(row.title),
    comment: String(row.comment),
    isVerifiedPurchase: Boolean(row.is_verified_purchase),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  })) satisfies ProductReview[];
}

export async function upsertProductReview(
  productId: string,
  mobile: string,
  review: Pick<ProductReview, "rating" | "title" | "comment">,
) {
  await readyDb();
  const sql = getSql();
  const productRows = (await sql`SELECT id FROM products WHERE id = ${productId} LIMIT 1`) as DbRow[];
  if (!productRows[0]) return null;
  const purchaseRows = (await sql`
    SELECT customer_name
    FROM orders
    WHERE mobile = ${mobile}
      AND items @> ${JSON.stringify([{ productId }])}::jsonb
      AND (payment_status = 'paid' OR payment_gateway = 'cod')
    ORDER BY created_at DESC
    LIMIT 1
  `) as DbRow[];
  const customerName = purchaseRows[0]?.customer_name ? String(purchaseRows[0].customer_name) : "NoteKart customer";
  const verified = Boolean(purchaseRows[0]);
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO product_reviews (id, product_id, customer_name, mobile, rating, title, comment, is_verified_purchase)
    VALUES (${id}, ${productId}, ${customerName}, ${mobile}, ${review.rating}, ${review.title}, ${review.comment}, ${verified})
    ON CONFLICT (product_id, mobile) DO UPDATE SET
      rating = EXCLUDED.rating,
      title = EXCLUDED.title,
      comment = EXCLUDED.comment,
      customer_name = EXCLUDED.customer_name,
      is_verified_purchase = EXCLUDED.is_verified_purchase,
      created_at = now()
  `;
  return id;
}

/** Decrement stock only when enough is available. Returns true if it succeeded. */
export async function decrementStock(productId: string, quantity: number) {
  await readyDb();
  const rows = (await getSql()`
    UPDATE products SET stock = stock - ${quantity}
    WHERE id = ${productId} AND stock >= ${quantity}
    RETURNING id
  `) as DbRow[];
  return rows.length > 0;
}

/**
 * Atomic fixed-window rate limiter. Returns true when the action is allowed.
 * The whole check-and-increment happens in one statement to avoid races.
 */
export async function consumeRateLimit(bucket: string, limit: number, windowSeconds: number) {
  await readyDb();
  const rows = (await getSql()`
    INSERT INTO rate_limits (bucket, count, window_start)
    VALUES (${bucket}, 1, now())
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second') THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} * interval '1 second') THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count
  `) as DbRow[];
  return Number(rows[0]?.count ?? limit + 1) <= limit;
}

export async function saveOtp(mobile: string, codeHash: string, expiresInSeconds: number) {
  await readyDb();
  await getSql()`
    INSERT INTO otp_codes (mobile, code_hash, attempts, expires_at, created_at)
    VALUES (${mobile}, ${codeHash}, 0, now() + (${expiresInSeconds} * interval '1 second'), now())
    ON CONFLICT (mobile) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      attempts = 0,
      expires_at = EXCLUDED.expires_at,
      created_at = now()
  `;
}

export async function getActiveOtp(mobile: string) {
  await readyDb();
  const rows = (await getSql()`
    SELECT code_hash, attempts FROM otp_codes
    WHERE mobile = ${mobile} AND expires_at > now()
    LIMIT 1
  `) as DbRow[];
  if (!rows[0]) return null;
  return { codeHash: String(rows[0].code_hash), attempts: Number(rows[0].attempts) };
}

export async function incrementOtpAttempts(mobile: string) {
  await readyDb();
  await getSql()`UPDATE otp_codes SET attempts = attempts + 1 WHERE mobile = ${mobile}`;
}

export async function deleteOtp(mobile: string) {
  await readyDb();
  await getSql()`DELETE FROM otp_codes WHERE mobile = ${mobile}`;
}

export async function getAnalytics() {
  await readyDb();
  const sql = getSql();
  const [products, custom, orders, revenue, sales, profit, trend] = (await Promise.all([
    sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(stock), 0)::int AS stock FROM products`,
    sql`SELECT COUNT(*)::int AS count FROM custom_requests`,
    sql`SELECT COUNT(*)::int AS count FROM orders`,
    sql`SELECT COALESCE(SUM(amount), 0)::int AS amount FROM orders WHERE delivery_status <> 'cancelled'`,
    sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0)::int AS daily,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', now())), 0)::int AS weekly,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::int AS monthly
      FROM orders WHERE delivery_status <> 'cancelled'
    `,
    sql`
      SELECT COALESCE(SUM(
        (COALESCE((item->>'price')::int, 0) - COALESCE((item->>'costPrice')::int, (item->>'price')::int, 0))
        * COALESCE((item->>'quantity')::int, 0)
      ), 0)::int AS amount
      FROM orders, jsonb_array_elements(items) AS item
      WHERE delivery_status <> 'cancelled'
    `,
    sql`
      SELECT day::date::text AS day, COALESCE(SUM(orders.amount), 0)::int AS amount
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS day
      LEFT JOIN orders ON orders.created_at >= day AND orders.created_at < day + INTERVAL '1 day'
        AND orders.delivery_status <> 'cancelled'
      GROUP BY day ORDER BY day
    `,
  ])) as DbRow[][];

  return {
    productCount: Number(products[0]?.count ?? 0),
    stock: Number(products[0]?.stock ?? 0),
    customRequestCount: Number(custom[0]?.count ?? 0),
    orderCount: Number(orders[0]?.count ?? 0),
    revenue: Number(revenue[0]?.amount ?? 0),
    reports: {
      dailySales: Number(sales[0]?.daily ?? 0),
      weeklySales: Number(sales[0]?.weekly ?? 0),
      monthlySales: Number(sales[0]?.monthly ?? 0),
      profit: Number(profit[0]?.amount ?? 0),
    },
    salesTrend: trend.map((row) => ({ day: String(row.day), amount: Number(row.amount) })),
  };
}
