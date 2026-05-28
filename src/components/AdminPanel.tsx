"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ImagePlus,
  IndianRupee,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  PackageCheck,
  Save,
  ShipWheel,
  ShoppingCart,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CustomRequest, DeliveryProvider, Order, Product } from "@/lib/types";

type AdminSection = "dashboard" | "products" | "custom-requests" | "orders" | "delivery" | "reports";

type Analytics = {
  productCount: number;
  stock: number;
  customRequestCount: number;
  orderCount: number;
  revenue: number;
};

type AdminPanelProps = {
  section?: AdminSection;
};

type Msg91VerifyData = Record<string, unknown>;

declare global {
  interface Window {
    initSendOTP?: (configuration: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: (data: unknown) => void, failure?: (error: unknown) => void) => void;
    retryOtp?: (channel: string | null, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
    verifyOtp?: (otp: string, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
    getWidgetData?: () => unknown;
    __notekartMsg91WidgetData?: unknown;
  }
}

const emptyProduct = {
  name: "",
  category: "Customized",
  price: 199,
  compareAtPrice: 249,
  stock: 20,
  description: "",
  specs: "Size: A5\nPages: 192\nPaper: 80 GSM\nBinding: Hardbound",
  images: "",
  isCustomizable: true,
  isFeatured: false,
};

const adminLinks: Array<{ href: string; label: string; section: AdminSection; icon: LucideIcon }> = [
  { href: "/admin", label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", section: "products", icon: Boxes },
  { href: "/admin/custom-requests", label: "Custom requests", section: "custom-requests", icon: ImagePlus },
  { href: "/admin/orders", label: "Orders", section: "orders", icon: ShoppingCart },
  { href: "/admin/delivery", label: "Delivery review", section: "delivery", icon: ShipWheel },
  { href: "/admin/reports", label: "Reports", section: "reports", icon: BarChart3 },
];

const deliveryProviders: Array<{ value: DeliveryProvider; label: string }> = [
  { value: "review", label: "Review first" },
  { value: "delhivery", label: "Delhivery" },
  { value: "post_office", label: "Post Office" },
  { value: "manual", label: "Manual/local" },
];

function sectionTitle(section: AdminSection) {
  return adminLinks.find((link) => link.section === section)?.label ?? "Dashboard";
}

function msg91WidgetConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_MSG91_WIDGET_ID && process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN);
}

function msg91Identifier(mobile: string) {
  return `91${mobile.replace(/\D/g, "").slice(-10)}`;
}

function extractMsg91AccessToken(data: unknown): string {
  if (typeof data === "string") return data.split(".").length === 3 ? data : "";
  if (!data || typeof data !== "object") return "";
  const record = data as Msg91VerifyData;
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (typeof value === "string" && (normalizedKey.includes("token") || value.split(".").length === 3)) {
      return value;
    }
    const nested = extractMsg91AccessToken(value);
    if (nested) return nested;
  }
  return "";
}

function rememberMsg91WidgetData(data: unknown) {
  window.__notekartMsg91WidgetData = data;
}

export function AdminPanel({ section = "dashboard" }: AdminPanelProps) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStage, setOtpStage] = useState<"mobile" | "code">("mobile");
  const [authBusy, setAuthBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [uploadMessage, setUploadMessage] = useState("");
  const [trackingAwb, setTrackingAwb] = useState("");
  const [tracking, setTracking] = useState("");

  const chartData = useMemo(
    () => [
      { name: "Products", value: analytics?.productCount ?? 0 },
      { name: "Orders", value: analytics?.orderCount ?? 0 },
      { name: "Custom", value: analytics?.customRequestCount ?? 0 },
      { name: "Stock", value: analytics?.stock ?? 0 },
    ],
    [analytics],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        if (data.user?.role === "admin") {
          setAuthorized(true);
          void loadAdminData();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!msg91WidgetConfigured() || window.sendOtp) return;
    const configuration = {
      widgetId: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,
      tokenAuth: process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN,
      exposeMethods: true,
      captchaRenderId: "",
      success: rememberMsg91WidgetData,
      failure: () => {},
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://verify.msg91.com/otp-provider.js"]');
    if (existing) {
      existing.addEventListener("load", () => window.initSendOTP?.(configuration));
      window.initSendOTP?.(configuration);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://verify.msg91.com/otp-provider.js";
    script.async = true;
    script.onload = () => window.initSendOTP?.(configuration);
    document.body.appendChild(script);
  }, []);

  async function loadAdminData() {
    const [productRes, requestRes, orderRes, analyticsRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/custom-requests"),
      fetch("/api/orders"),
      fetch("/api/admin/analytics"),
    ]);
    setProducts((await productRes.json()).products ?? []);
    setRequests((await requestRes.json()).requests ?? []);
    setOrders((await orderRes.json()).orders ?? []);
    setAnalytics(await analyticsRes.json());
  }

  async function requestOtp() {
    setLoginError("");
    setAuthBusy(true);
    try {
      if (msg91WidgetConfigured()) {
        if (!window.sendOtp) {
          setLoginError("MSG91 OTP is loading. Please try again in a moment.");
          return;
        }
        await new Promise<void>((resolve, reject) => {
          window.sendOtp?.(msg91Identifier(mobile), () => resolve(), (error) => reject(error));
        });
        setOtpStage("code");
        setLoginError("OTP sent to your mobile.");
        return;
      }

      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error ?? "Could not send OTP.");
        return;
      }
      setOtpStage("code");
      if (data.devCode) setLoginError(`Dev OTP: ${data.devCode}`);
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyOtp() {
    setLoginError("");
    setAuthBusy(true);
    try {
      if (msg91WidgetConfigured()) {
        if (!window.verifyOtp) {
          setLoginError("MSG91 OTP is still loading. Please try again.");
          return;
        }
        const widgetData = await new Promise<unknown>((resolve, reject) => {
          window.verifyOtp?.(otp, (data) => {
            rememberMsg91WidgetData(data);
            resolve(data);
          }, (error) => reject(error));
        });
        const accessToken =
          extractMsg91AccessToken(widgetData) ||
          extractMsg91AccessToken(window.__notekartMsg91WidgetData) ||
          extractMsg91AccessToken(window.getWidgetData?.());
        if (!accessToken) {
          setLoginError("MSG91 verified OTP but did not return an access token.");
          return;
        }
        const response = await fetch("/api/auth/msg91-widget/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, accessToken }),
        });
        const data = await response.json();
        if (!response.ok) {
          setLoginError(data.error ?? "Could not create NoteKart session.");
          return;
        }
        if (data.user?.role !== "admin") {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          setLoginError("This mobile number is not registered as an admin.");
          return;
        }
        setOtp("");
        setOtpStage("mobile");
        await loadAdminData();
        setAuthorized(true);
        return;
      }

      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code: otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error ?? "Verification failed.");
        return;
      }
      if (data.user?.role !== "admin") {
        // Not an admin number — drop the just-created customer session.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        setLoginError("This mobile number is not registered as an admin.");
        return;
      }
      setOtp("");
      setOtpStage("mobile");
      await loadAdminData();
      setAuthorized(true);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthorized(false);
    setOtpStage("mobile");
    setOtp("");
  }

  function parseSpecs(text: string) {
    return Object.fromEntries(
      text
        .split("\n")
        .map((line) => line.split(":").map((part) => part.trim()))
        .filter(([key, value]) => key && value),
    );
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        images: form.images.split("\n").map((url) => url.trim()).filter(Boolean),
        specs: parseSpecs(form.specs),
      }),
    });
    if (response.ok) {
      setForm(emptyProduct);
      await loadAdminData();
    }
  }

  async function uploadProductImage(file: File) {
    setUploadMessage("Uploading to Cloudinary...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setUploadMessage(data.error ?? "Upload failed.");
      return;
    }
    setForm((current) => ({ ...current, images: [current.images, data.url].filter(Boolean).join("\n") }));
    setUploadMessage("Image added to product form.");
  }

  async function deleteProduct(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await loadAdminData();
  }

  async function trackShipment() {
    setTracking("Checking Delhivery...");
    const response = await fetch("/api/delhivery/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waybill: trackingAwb }),
    });
    const data = await response.json();
    setTracking(JSON.stringify(data.tracking ?? data, null, 2));
  }

  if (checkingSession) {
    return <main className="admin-login" />;
  }

  if (!authorized) {
    return (
      <main className="admin-login">
        <section className="admin-login-card">
          <LockKeyhole size={34} />
          <h1>NoteKart Admin</h1>
          <p>Enter your registered admin mobile number to receive a one-time password.</p>
          {otpStage === "mobile" ? (
            <>
              <input
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Admin mobile number"
                inputMode="numeric"
              />
              <button
                className="primary-button justify-center"
                onClick={requestOtp}
                disabled={authBusy || mobile.length !== 10}
              >
                {authBusy ? "Sending..." : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter OTP"
                inputMode="numeric"
                maxLength={8}
              />
              <button
                className="primary-button justify-center"
                onClick={verifyOtp}
                disabled={authBusy || otp.length < 4}
              >
                {authBusy ? "Verifying..." : "Unlock admin panel"}
              </button>
              <button
                className="secondary-button justify-center"
                onClick={() => {
                  setOtpStage("mobile");
                  setOtp("");
                  setLoginError("");
                }}
              >
                Change number
              </button>
            </>
          )}
          {loginError ? <span className="form-status">{loginError}</span> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          <LayoutDashboard size={20} /> NoteKart
        </Link>
        <AdminNav activeSection={section} onNavigate={() => setMenuOpen(false)} />
      </aside>

      <section className="admin-main">
        <div className="admin-mobile-bar">
          <button className="icon-button" onClick={() => setMenuOpen((current) => !current)} aria-label="Admin menu">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <strong>{sectionTitle(section)}</strong>
          <button className="secondary-button" onClick={logout}>Logout</button>
        </div>
        {menuOpen ? (
          <nav className="admin-mobile-menu">
            <AdminNav activeSection={section} onNavigate={() => setMenuOpen(false)} />
          </nav>
        ) : null}

        <div className="admin-topbar">
          <div>
            <p>Admin console</p>
            <h1>{adminHeadline(section)}</h1>
          </div>
          <div className="admin-top-actions">
            <Link href="/" className="secondary-button">Open storefront</Link>
            <button className="secondary-button admin-desktop-only" onClick={logout}>Logout</button>
          </div>
        </div>

        {section === "dashboard" ? <Dashboard analytics={analytics} orders={orders} requests={requests} /> : null}
        {section === "reports" ? <Reports chartData={chartData} analytics={analytics} /> : null}
        {section === "products" ? (
          <ProductsPanel
            form={form}
            products={products}
            uploadMessage={uploadMessage}
            onDeleteProduct={deleteProduct}
            onFormChange={setForm}
            onSaveProduct={saveProduct}
            onUploadProductImage={uploadProductImage}
          />
        ) : null}
        {section === "custom-requests" ? <CustomRequestsPanel requests={requests} /> : null}
        {section === "orders" ? <OrdersPanel orders={orders} /> : null}
        {section === "delivery" ? (
          <DeliveryPanel
            orders={orders}
            trackingAwb={trackingAwb}
            tracking={tracking}
            onTrackingAwbChange={setTrackingAwb}
            onTrackShipment={trackShipment}
            onDeliverySaved={loadAdminData}
          />
        ) : null}
      </section>
    </main>
  );
}

function AdminNav({ activeSection, onNavigate }: { activeSection: AdminSection; onNavigate: () => void }) {
  return (
    <>
      {adminLinks.map(({ href, label, section, icon: Icon }) => (
        <Link className={activeSection === section ? "active" : ""} href={href} key={href} onClick={onNavigate}>
          <Icon size={18} /> {label}
        </Link>
      ))}
    </>
  );
}

function adminHeadline(section: AdminSection) {
  const titles: Record<AdminSection, string> = {
    dashboard: "Today's control room for NoteKart",
    products: "Products, categories, media and stock",
    "custom-requests": "Custom notebook artwork requests",
    orders: "Paid orders and customer details",
    delivery: "Review each order and assign delivery",
    reports: "Reports, revenue and operational analysis",
  };
  return titles[section];
}

function Dashboard({ analytics, orders, requests }: { analytics: Analytics | null; orders: Order[]; requests: CustomRequest[] }) {
  const pendingDelivery = orders.filter((order) => order.deliveryProvider === "review").length;
  return (
    <section className="admin-section-stack">
      <div className="admin-grid">
        {([
          ["Products", analytics?.productCount ?? 0, Boxes],
          ["Orders", analytics?.orderCount ?? 0, ShoppingCart],
          ["Custom requests", analytics?.customRequestCount ?? 0, ImagePlus],
          ["Revenue", `₹${analytics?.revenue ?? 0}`, IndianRupee],
        ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => (
          <div className="admin-stat" key={String(label)}>
            <Icon size={20} />
            <span>{String(label)}</span>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
      <section className="admin-panel">
        <div className="panel-title">
          <ShipWheel size={20} />
          <h2>Needs review</h2>
        </div>
        <div className="admin-review-grid">
          <div>
            <strong>{pendingDelivery}</strong>
            <span>orders waiting for courier decision</span>
          </div>
          <div>
            <strong>{requests.filter((request) => request.status === "new").length}</strong>
            <span>new custom requests</span>
          </div>
          <Link className="primary-button justify-center" href="/admin/delivery">Open delivery review</Link>
        </div>
      </section>
    </section>
  );
}

function Reports({ chartData, analytics }: { chartData: Array<{ name: string; value: number }>; analytics: Analytics | null }) {
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <BarChart3 size={20} />
        <h2>Reports and analysis</h2>
      </div>
      <div className="admin-report-summary">
        <span>Revenue ₹{analytics?.revenue ?? 0}</span>
        <span>{analytics?.stock ?? 0} notebooks in stock</span>
        <span>{analytics?.orderCount ?? 0} total orders</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="notekartChart" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0c8f84" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#0c8f84" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ded6c4" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#0c8f84" fill="url(#notekartChart)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ProductsPanel({
  form,
  products,
  uploadMessage,
  onDeleteProduct,
  onFormChange,
  onSaveProduct,
  onUploadProductImage,
}: {
  form: typeof emptyProduct;
  products: Product[];
  uploadMessage: string;
  onDeleteProduct: (id: string) => Promise<void>;
  onFormChange: (form: typeof emptyProduct) => void;
  onSaveProduct: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadProductImage: (file: File) => Promise<void>;
}) {
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <PackageCheck size={20} />
        <h2>Product and category management</h2>
      </div>
      <form className="admin-form" onSubmit={onSaveProduct}>
        <input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Product name" required />
        <input value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value })} placeholder="Category" />
        <div className="grid gap-3 md:grid-cols-3">
          <input type="number" value={form.price} onChange={(event) => onFormChange({ ...form, price: Number(event.target.value) })} placeholder="Price" />
          <input type="number" value={form.compareAtPrice} onChange={(event) => onFormChange({ ...form, compareAtPrice: Number(event.target.value) })} placeholder="MRP" />
          <input type="number" value={form.stock} onChange={(event) => onFormChange({ ...form, stock: Number(event.target.value) })} placeholder="Stock" />
        </div>
        <textarea value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Description" rows={3} />
        <textarea value={form.specs} onChange={(event) => onFormChange({ ...form, specs: event.target.value })} placeholder="Specifications, one per line as Key: Value" rows={5} />
        <textarea value={form.images} onChange={(event) => onFormChange({ ...form, images: event.target.value })} placeholder="Image URLs, one per line" rows={4} />
        <label className="admin-upload">
          <input type="file" accept="image/*,video/*" onChange={(event) => event.target.files?.[0] && onUploadProductImage(event.target.files[0])} />
          <UploadCloud size={22} /> Upload product media to Cloudinary
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label><input type="checkbox" checked={form.isCustomizable} onChange={(event) => onFormChange({ ...form, isCustomizable: event.target.checked })} /> Customizable</label>
          <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => onFormChange({ ...form, isFeatured: event.target.checked })} /> Featured</label>
        </div>
        <button className="primary-button justify-center" type="submit"><Save size={18} /> Save product</button>
        {uploadMessage ? <span className="form-status">{uploadMessage}</span> : null}
      </form>

      <div className="admin-table">
        {products.map((product) => (
          <div className="admin-row" key={product.id}>
            <img src={product.images[0]} alt={product.name} />
            <div>
              <strong>{product.name}</strong>
              <span>{product.category} · ₹{product.price} · {product.stock} in stock</span>
            </div>
            <button className="icon-button" onClick={() => onDeleteProduct(product.id)} aria-label={`Delete ${product.name}`}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomRequestsPanel({ requests }: { requests: CustomRequest[] }) {
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <ImagePlus size={20} />
        <h2>Custom notebook requests</h2>
      </div>
      <div className="admin-table">
        {requests.map((request) => (
          <div className="admin-row" key={request.id}>
            {request.imageUrl ? <img src={request.imageUrl} alt={request.customerName} /> : <span className="empty-thumb" />}
            <div>
              <strong>{request.customerName} · {request.mobile}</strong>
              <span>{request.quantity} pcs · {request.notes}</span>
            </div>
            <CheckCircle2 size={20} />
          </div>
        ))}
      </div>
    </section>
  );
}

function OrdersPanel({ orders }: { orders: Order[] }) {
  return (
    <section className="admin-panel">
      <div className="panel-title">
        <ShoppingCart size={20} />
        <h2>Orders and payment status</h2>
      </div>
      <div className="admin-table">
        {orders.map((order) => (
          <div className="admin-row order-row" key={order.id}>
            <span className="empty-thumb" />
            <div>
              <strong>{order.customerName} · ₹{order.amount}</strong>
              <span>{order.mobile} · {order.items.length} item lines · {order.address}</span>
              <span>{order.paymentStatus} payment · {formatProvider(order.deliveryProvider)} · {order.deliveryStatus}</span>
            </div>
            <span className="admin-pill">{order.phonepePaymentId ?? "No payment id"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeliveryPanel({
  orders,
  trackingAwb,
  tracking,
  onTrackingAwbChange,
  onTrackShipment,
  onDeliverySaved,
}: {
  orders: Order[];
  trackingAwb: string;
  tracking: string;
  onTrackingAwbChange: (value: string) => void;
  onTrackShipment: () => Promise<void>;
  onDeliverySaved: () => Promise<void>;
}) {
  return (
    <section className="admin-section-stack">
      <section className="admin-panel">
        <div className="panel-title">
          <ShipWheel size={20} />
          <h2>Delivery assignment</h2>
        </div>
        <div className="admin-table">
          {orders.map((order) => (
            <div className="delivery-card" key={order.id}>
              <div>
                <strong>{order.customerName} · ₹{order.amount}</strong>
                <span>{order.mobile}</span>
                <span>{order.address}</span>
                <span>{order.paymentStatus} payment · {order.items.length} item lines</span>
              </div>
              <DeliveryAssignmentForm order={order} onSaved={onDeliverySaved} />
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-title">
          <ShipWheel size={20} />
          <h2>Delhivery tracking</h2>
        </div>
        <div className="track-box">
          <input value={trackingAwb} onChange={(event) => onTrackingAwbChange(event.target.value)} placeholder="Enter Delhivery waybill / AWB code" />
          <button className="primary-button justify-center" onClick={onTrackShipment}>Track shipment</button>
        </div>
        {tracking ? <pre className="tracking-output">{tracking}</pre> : null}
      </section>
    </section>
  );
}

function DeliveryAssignmentForm({ order, onSaved }: { order: Order; onSaved: () => Promise<void> }) {
  const [provider, setProvider] = useState<DeliveryProvider>(order.deliveryProvider ?? "review");
  const [trackingNumber, setTrackingNumber] = useState(order.deliveryTrackingNumber ?? "");
  const [deliveryStatus, setDeliveryStatus] = useState(order.deliveryStatus ?? "review");
  const [deliveryNotes, setDeliveryNotes] = useState(order.deliveryNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await fetch(`/api/orders/${order.id}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, trackingNumber, deliveryStatus, deliveryNotes }),
    });
    await onSaved();
    setSaving(false);
  }

  return (
    <form className="delivery-form" onSubmit={saveDelivery}>
      <select value={provider} onChange={(event) => setProvider(event.target.value as DeliveryProvider)}>
        {deliveryProviders.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="AWB / speed post / manual ref" />
      <select value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)}>
        <option value="review">Review</option>
        <option value="packed">Packed</option>
        <option value="assigned">Assigned</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
      </select>
      <textarea value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} placeholder="Internal delivery notes" rows={2} />
      <button className="primary-button justify-center" disabled={saving} type="submit">{saving ? "Saving..." : "Save delivery"}</button>
    </form>
  );
}

function formatProvider(provider?: DeliveryProvider | null) {
  return deliveryProviders.find((option) => option.value === provider)?.label ?? "Review first";
}
