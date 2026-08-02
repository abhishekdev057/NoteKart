"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  ImagePlus,
  IndianRupee,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShipWheel,
  ShoppingCart,
  Smartphone,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DelhiveryTrackingCard } from "@/components/DelhiveryTrackingCard";
import type { CustomRequest, DelhiverySettings, DeliveryProvider, Order, PaymentGateway, Product } from "@/lib/types";

type AdminSection = "dashboard" | "products" | "custom-requests" | "orders" | "delivery" | "payments" | "reports";

type Analytics = {
  productCount: number;
  stock: number;
  customRequestCount: number;
  orderCount: number;
  revenue: number;
  reports: {
    dailySales: number;
    weeklySales: number;
    monthlySales: number;
    profit: number;
  };
  salesTrend: Array<{ day: string; amount: number }>;
};

type AdminPanelProps = {
  section?: AdminSection;
};

type DeleteResult = { ok: boolean; message: string };

type Msg91VerifyData = Record<string, unknown>;
type ProductForm = {
  id?: string;
  slug?: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  compareAtPrice: number | null;
  stock: number;
  description: string;
  specs: string;
  images: string;
  isCustomizable: boolean;
  isFeatured: boolean;
};

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

const emptyProduct: ProductForm = {
  name: "",
  category: "Customized",
  price: 199,
  costPrice: 110,
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
  { href: "/admin/payments", label: "Payment gateway", section: "payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", section: "reports", icon: BarChart3 },
];

const deliveryProviders: Array<{ value: DeliveryProvider; label: string }> = [
  { value: "review", label: "Review first" },
  { value: "delhivery", label: "Delhivery" },
  { value: "post_office", label: "Post Office" },
  { value: "manual", label: "Manual/local" },
];

const gatewayOptions: Array<{ value: PaymentGateway; label: string; note: string }> = [
  { value: "cashfree", label: "Cashfree", note: "Default checkout for live customer payments" },
  { value: "phonepe", label: "PhonePe", note: "Available when PhonePe credentials are active" },
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
    const isWidgetConfigToken = ["tokenauth", "widgettoken", "authtoken"].includes(normalizedKey);
    const isAccessTokenKey = ["accesstoken", "verifiedtoken", "verificationtoken"].includes(normalizedKey);
    if (typeof value === "string" && !isWidgetConfigToken && (isAccessTokenKey || value.split(".").length === 3)) {
      return value;
    }
    const nested = extractMsg91AccessToken(value);
    if (nested) return nested;
  }
  return "";
}

function extractMsg91ReqId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Msg91VerifyData;
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (typeof value === "string" && ["reqid", "requestid"].includes(normalizedKey)) return value;
    const nested = extractMsg91ReqId(value);
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
  const [msg91ReqId, setMsg91ReqId] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [editingProductId, setEditingProductId] = useState("");
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [paymentGateway, setPaymentGateway] = useState<PaymentGateway>("cashfree");
  const [paymentGatewayMessage, setPaymentGatewayMessage] = useState("");
  const [delhiverySettings, setDelhiverySettings] = useState<DelhiverySettings>({
    pickupLocation: "NoteKart",
    defaultWeightGrams: 500,
  });
  const [delhiverySettingsMessage, setDelhiverySettingsMessage] = useState("");
  const [delhiverySettingsSaving, setDelhiverySettingsSaving] = useState(false);

  const chartData = useMemo(
    () => (analytics?.salesTrend ?? []).map((item) => ({
      name: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(`${item.day}T00:00:00`)),
      value: item.amount,
    })),
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
        } else if (data.user) {
          window.location.replace("/");
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
    const [productRes, requestRes, orderRes, analyticsRes, gatewayRes, delhiverySettingsRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/custom-requests"),
      fetch("/api/orders"),
      fetch("/api/admin/analytics"),
      fetch("/api/admin/payment-gateway"),
      fetch("/api/admin/delhivery-settings"),
    ]);
    setProducts((await productRes.json()).products ?? []);
    setRequests((await requestRes.json()).requests ?? []);
    setOrders((await orderRes.json()).orders ?? []);
    setAnalytics(await analyticsRes.json());
    if (gatewayRes.ok) {
      const data = await gatewayRes.json();
      setPaymentGateway(data.gateway ?? "cashfree");
    }
    if (delhiverySettingsRes.ok) {
      const data = await delhiverySettingsRes.json();
      if (data.settings) setDelhiverySettings(data.settings);
    }
  }

  async function savePaymentGateway(gateway: PaymentGateway) {
    setPaymentGateway(gateway);
    setPaymentGatewayMessage("Saving payment gateway...");
    const response = await fetch("/api/admin/payment-gateway", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway }),
    });
    const data = await response.json();
    if (!response.ok) {
      setPaymentGatewayMessage(data.error ?? "Could not update payment gateway.");
      return;
    }
    setPaymentGateway(data.gateway ?? gateway);
    setPaymentGatewayMessage(`${data.label ?? "Gateway"} is now active for checkout.`);
  }

  async function saveDelhiverySettings() {
    setDelhiverySettingsSaving(true);
    setDelhiverySettingsMessage("Saving Delhivery settings...");
    try {
      const response = await fetch("/api/admin/delhivery-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delhiverySettings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDelhiverySettingsMessage(data.error ?? "Could not save Delhivery settings.");
        return;
      }
      setDelhiverySettings(data.settings ?? delhiverySettings);
      setDelhiverySettingsMessage("Pickup location and default parcel weight saved.");
    } catch {
      setDelhiverySettingsMessage("Could not connect while saving Delhivery settings.");
    } finally {
      setDelhiverySettingsSaving(false);
    }
  }

  async function requestOtp() {
    setLoginError("");
    setAuthBusy(true);
    try {
      const accessResponse = await fetch("/api/auth/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const accessData = await accessResponse.json();
      if (!accessResponse.ok) {
        if (accessResponse.status === 403) {
          await redirectToStorefront(accessData.redirect);
          return;
        }
        setLoginError(accessData.error ?? "Could not check admin access.");
        return;
      }

      if (msg91WidgetConfigured()) {
        if (!window.sendOtp) {
          setLoginError("MSG91 OTP is loading. Please try again in a moment.");
          return;
        }
        const sendData = await new Promise<unknown>((resolve, reject) => {
          window.sendOtp?.(msg91Identifier(mobile), (data) => resolve(data), (error) => reject(error));
        });
        rememberMsg91WidgetData(sendData);
        setMsg91ReqId(extractMsg91ReqId(sendData));
        setOtpStage("code");
        setLoginError("OTP sent to your mobile.");
        return;
      }

      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, purpose: "admin" }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          await redirectToStorefront(data.redirect);
          return;
        }
        setLoginError(data.error ?? "Could not send OTP.");
        return;
      }
      setOtpStage("code");
      setLoginError(data.message ?? "OTP sent to your mobile.");
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
          }, (error) => reject(error), msg91ReqId || undefined);
        });
        const accessToken =
          extractMsg91AccessToken(widgetData) ||
          extractMsg91AccessToken(window.__notekartMsg91WidgetData);
        if (!accessToken) {
          setLoginError("MSG91 verified OTP but did not return an access token.");
          return;
        }
        const response = await fetch("/api/auth/msg91-widget/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, accessToken, purpose: "admin" }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 403) {
            await redirectToStorefront(data.redirect);
            return;
          }
          setLoginError(data.error ?? "Could not create NoteKart session.");
          return;
        }
        if (data.user?.role !== "admin") {
          await redirectToStorefront();
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
        body: JSON.stringify({ mobile, code: otp, purpose: "admin" }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          await redirectToStorefront(data.redirect);
          return;
        }
        setLoginError(data.error ?? "Verification failed.");
        return;
      }
      if (data.user?.role !== "admin") {
        await redirectToStorefront();
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

  async function redirectToStorefront(path = "/") {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace(path || "/");
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
        id: form.id || undefined,
        slug: form.slug || undefined,
        images: form.images.split("\n").map((url) => url.trim()).filter(Boolean),
        specs: parseSpecs(form.specs),
      }),
    });
    if (response.ok) {
      setForm(emptyProduct);
      setEditingProductId("");
      setProductEditorOpen(false);
      setUploadMessage(editingProductId ? "Product updated." : "Product saved.");
      await loadAdminData();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setUploadMessage(data.error ?? "Could not save product.");
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
    if (editingProductId === id) {
      setForm(emptyProduct);
      setEditingProductId("");
      setProductEditorOpen(false);
    }
    await loadAdminData();
  }

  async function deleteAdminRecords(resource: "orders" | "custom-requests", ids: string[]): Promise<DeleteResult> {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (!uniqueIds.length) return { ok: false, message: "Select at least one record." };

    try {
      const response = uniqueIds.length === 1
        ? await fetch(`/api/${resource}/${encodeURIComponent(uniqueIds[0])}`, { method: "DELETE" })
        : await fetch(`/api/${resource}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: uniqueIds }),
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, message: data.error ?? "Could not delete the selected records." };
      }
      await loadAdminData();
      return {
        ok: true,
        message: `${data.deletedCount ?? uniqueIds.length} ${resource === "orders" ? "order" : "request"}${(data.deletedCount ?? uniqueIds.length) === 1 ? "" : "s"} permanently deleted.`,
      };
    } catch {
      return { ok: false, message: "Could not connect while deleting records." };
    }
  }

  function productToForm(product: Product): ProductForm {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: product.price,
      costPrice: product.costPrice ?? 0,
      compareAtPrice: product.compareAtPrice ?? null,
      stock: product.stock,
      description: product.description,
      specs: Object.entries(product.specs).map(([key, value]) => `${key}: ${value}`).join("\n"),
      images: product.images.join("\n"),
      isCustomizable: product.isCustomizable,
      isFeatured: product.isFeatured,
    };
  }

  function editProduct(product: Product) {
    setForm(productToForm(product));
    setEditingProductId(product.id);
    setProductEditorOpen(true);
    setUploadMessage(`Editing ${product.name}.`);
    requestAnimationFrame(() => {
      document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetProductForm() {
    setForm(emptyProduct);
    setEditingProductId("");
    setUploadMessage("");
  }

  function toggleProductEditor() {
    resetProductForm();
    setProductEditorOpen((current) => !current);
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
    <main className={`admin-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <Link href="/admin" className="admin-brand" title="NoteKart admin">
            <LayoutDashboard size={20} /> <span className="admin-sidebar-label">NoteKart</span>
          </Link>
          <button
            className="admin-sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="admin-sidebar-nav">
          <AdminNav activeSection={section} onNavigate={() => setMenuOpen(false)} />
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-storefront-link" title="Open storefront">
            <ExternalLink size={16} /> <span className="admin-sidebar-label">Open storefront</span>
          </Link>
          <button className="admin-logout-button" type="button" onClick={logout} title="Logout">
            <LogOut size={17} /> <span className="admin-sidebar-label">Logout</span>
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <div className="admin-mobile-bar">
          <button className="icon-button" onClick={() => setMenuOpen((current) => !current)} aria-label="Admin menu">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <strong>{sectionTitle(section)}</strong>
          <span className="admin-mobile-bar-spacer" />
        </div>
        {menuOpen ? (
          <nav className="admin-mobile-menu">
            <AdminNav activeSection={section} onNavigate={() => setMenuOpen(false)} />
            <div className="admin-mobile-menu-footer">
              <Link href="/" onClick={() => setMenuOpen(false)}><ExternalLink size={16} /> Open storefront</Link>
              <button type="button" onClick={logout}><LogOut size={17} /> Logout</button>
            </div>
          </nav>
        ) : null}

        <div className="admin-topbar">
          <div>
            <p>Admin console</p>
            <h1>{adminHeadline(section)}</h1>
          </div>
        </div>

        {section === "dashboard" ? (
          <Dashboard
            analytics={analytics}
            orders={orders}
            requests={requests}
          />
        ) : null}
        {section === "reports" ? (
          <Reports
            chartData={chartData}
            analytics={analytics}
          />
        ) : null}
        {section === "payments" ? (
          <PaymentGatewayPage
            orders={orders}
            paymentGateway={paymentGateway}
            message={paymentGatewayMessage}
            onChange={savePaymentGateway}
          />
        ) : null}
        {section === "products" ? (
          <ProductsPanel
            form={form}
            products={products}
            uploadMessage={uploadMessage}
            editingProductId={editingProductId}
            editorOpen={productEditorOpen}
            onDeleteProduct={deleteProduct}
            onEditProduct={editProduct}
            onFormChange={setForm}
            onResetForm={resetProductForm}
            onSaveProduct={saveProduct}
            onToggleEditor={toggleProductEditor}
            onUploadProductImage={uploadProductImage}
          />
        ) : null}
        {section === "custom-requests" ? (
          <CustomRequestsPanel
            requests={requests}
            onDeleteRequests={(ids) => deleteAdminRecords("custom-requests", ids)}
          />
        ) : null}
        {section === "orders" ? (
          <OrdersPanel
            orders={orders}
            products={products}
            onDeleteOrders={(ids) => deleteAdminRecords("orders", ids)}
          />
        ) : null}
        {section === "delivery" ? (
          <DeliveryPanel
            delhiverySettings={delhiverySettings}
            delhiverySettingsMessage={delhiverySettingsMessage}
            delhiverySettingsSaving={delhiverySettingsSaving}
            orders={orders}
            products={products}
            onDelhiverySettingsChange={setDelhiverySettings}
            onDelhiverySettingsSave={saveDelhiverySettings}
            onDeliverySaved={loadAdminData}
            onDeleteOrders={(ids) => deleteAdminRecords("orders", ids)}
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
        <Link className={activeSection === section ? "active" : ""} href={href} key={href} onClick={onNavigate} title={label}>
          <Icon size={18} /> <span className="admin-sidebar-label">{label}</span>
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
    payments: "Choose a gateway and review transactions",
    reports: "Reports, revenue and operational analysis",
  };
  return titles[section];
}

type CanonicalOrderStatus = "pending" | "printing" | "shipped" | "delivered" | "cancelled";

function canonicalOrderStatus(status?: string): CanonicalOrderStatus {
  const value = (status ?? "pending").toLowerCase();
  if (value === "delivered") return "delivered";
  if (value === "shipped") return "shipped";
  if (value === "cancelled") return "cancelled";
  if (["printing", "processing", "packed", "assigned"].includes(value)) return "printing";
  return "pending";
}

const orderStatusMeta: Array<{ value: CanonicalOrderStatus; label: string; icon: LucideIcon }> = [
  { value: "pending", label: "Pending", icon: Clock3 },
  { value: "printing", label: "Printing / Processing", icon: PackageCheck },
  { value: "shipped", label: "Shipped", icon: ShipWheel },
  { value: "delivered", label: "Delivered", icon: CheckCircle2 },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

function Dashboard({
  analytics,
  orders,
  requests,
}: {
  analytics: Analytics | null;
  orders: Order[];
  requests: CustomRequest[];
}) {
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
          <ShoppingCart size={20} />
          <h2>Live order status</h2>
        </div>
        <div className="order-status-grid">
          {orderStatusMeta.map(({ value, label, icon: Icon }) => (
            <Link href="/admin/orders" className={`order-status-card ${value}`} key={value}>
              <Icon size={19} />
              <span>{label}</span>
              <strong>{orders.filter((order) => canonicalOrderStatus(order.deliveryStatus) === value).length}</strong>
            </Link>
          ))}
        </div>
      </section>
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

function Reports({
  chartData,
  analytics,
}: {
  chartData: Array<{ name: string; value: number }>;
  analytics: Analytics | null;
}) {
  return (
    <section className="admin-section-stack">
      <section className="admin-panel">
        <div className="panel-title">
          <BarChart3 size={20} />
          <h2>Sales & profit reports</h2>
        </div>
        <div className="report-card-grid">
          {([
            ["Daily sales", analytics?.reports?.dailySales ?? 0, CalendarDays],
            ["Weekly sales", analytics?.reports?.weeklySales ?? 0, BarChart3],
            ["Monthly sales", analytics?.reports?.monthlySales ?? 0, ShoppingCart],
            ["Estimated profit", analytics?.reports?.profit ?? 0, IndianRupee],
          ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
            <div className="report-card" key={String(label)}>
              <Icon size={20} />
              <span>{String(label)}</span>
              <strong>₹{Number(value).toLocaleString("en-IN")}</strong>
            </div>
          ))}
        </div>
        <p className="report-help">Profit uses the production cost saved on each product. Cancelled orders are excluded.</p>
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
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Sales"]} />
              <Area type="monotone" dataKey="value" stroke="#0c8f84" fill="url(#notekartChart)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </section>
  );
}

type DatePreset = "all" | "today" | "yesterday" | "last7" | "last30" | "custom";
type DateFilterValue = { preset: DatePreset; from: string; to: string };

const emptyDateFilter: DateFilterValue = { preset: "all", from: "", to: "" };

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateMatches(value: string | undefined, filter: DateFilterValue) {
  if (filter.preset === "all") return true;
  if (!value) return false;
  const itemDate = new Date(value);
  if (Number.isNaN(itemDate.getTime())) return false;
  const today = startOfLocalDay(new Date());
  let from: Date | null = null;
  let to: Date | null = null;

  if (filter.preset === "today") {
    from = today;
    to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  } else if (filter.preset === "yesterday") {
    from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    to = today;
  } else if (filter.preset === "last7" || filter.preset === "last30") {
    const days = filter.preset === "last7" ? 7 : 30;
    from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
    to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  } else {
    from = filter.from ? new Date(`${filter.from}T00:00:00`) : null;
    to = filter.to ? new Date(`${filter.to}T23:59:59.999`) : null;
  }

  return (!from || itemDate >= from) && (!to || itemDate <= to);
}

function formatAdminDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DateFilterBar({ value, onChange }: { value: DateFilterValue; onChange: (value: DateFilterValue) => void }) {
  return (
    <div className="admin-date-filters">
      <label>
        <span><CalendarRange size={14} /> Date range</span>
        <select
          value={value.preset}
          onChange={(event) => onChange({ ...value, preset: event.target.value as DatePreset })}
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="custom">Custom calendar</option>
        </select>
      </label>
      <label>
        <span>From</span>
        <input
          type="date"
          value={value.from}
          onChange={(event) => onChange({ ...value, preset: "custom", from: event.target.value })}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="date"
          value={value.to}
          onChange={(event) => onChange({ ...value, preset: "custom", to: event.target.value })}
        />
      </label>
      <button type="button" onClick={() => onChange(emptyDateFilter)} disabled={value.preset === "all" && !value.from && !value.to}>
        Clear dates
      </button>
    </div>
  );
}

type PaymentStateFilter = "all" | "successful" | "pending" | "failed";

function paymentState(status: string): Exclude<PaymentStateFilter, "all"> {
  const value = status.toLowerCase();
  if (value === "paid") return "successful";
  if (["failed", "cancelled", "amount_mismatch"].includes(value)) return "failed";
  return "pending";
}

function PaymentGatewayPage({
  orders,
  paymentGateway,
  message,
  onChange,
}: {
  orders: Order[];
  paymentGateway: PaymentGateway;
  message: string;
  onChange: (gateway: PaymentGateway) => Promise<void>;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(emptyDateFilter);
  const [statusFilter, setStatusFilter] = useState<PaymentStateFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const gatewayTransactions = orders.filter((order) => order.paymentGateway === paymentGateway);
  const visibleTransactions = gatewayTransactions.filter((order) => {
    const matchesStatus = statusFilter === "all" || paymentState(order.paymentStatus) === statusFilter;
    const matchesDate = dateMatches(order.createdAt, dateFilter);
    const matchesQuery = !normalizedQuery || [order.id, order.customerName, order.mobile, order.paymentReference ?? ""]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesDate && matchesQuery;
  });
  const successful = visibleTransactions.filter((order) => paymentState(order.paymentStatus) === "successful");
  const pending = visibleTransactions.filter((order) => paymentState(order.paymentStatus) === "pending");
  const failed = visibleTransactions.filter((order) => paymentState(order.paymentStatus) === "failed");
  const activeGateway = gatewayOptions.find((option) => option.value === paymentGateway);

  return (
    <section className="admin-section-stack">
      <section className="admin-panel payment-control-panel">
        <div className="panel-title">
          <CreditCard size={20} />
          <h2>Payment gateway control</h2>
        </div>
        <div className="payment-gateway-control">
          <div className="payment-active-card">
            <span>Currently active</span>
            <strong>{activeGateway?.label ?? paymentGateway}</strong>
            <p>{activeGateway?.note}</p>
          </div>
          <label>
            <span>Choose active gateway</span>
            <select value={paymentGateway} onChange={(event) => void onChange(event.target.value as PaymentGateway)}>
              {gatewayOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {message ? <span className="form-status">{message}</span> : null}
      </section>

      <section className="admin-panel">
        <div className="panel-title payment-title-row">
          <Smartphone size={20} />
          <div>
            <h2>{activeGateway?.label} transactions</h2>
            <span>Only real orders recorded against the active gateway are shown.</span>
          </div>
        </div>
        <div className="payment-summary-grid">
          <div><span>Filtered transactions</span><strong>{visibleTransactions.length}</strong></div>
          <div className="success"><span>Successful value</span><strong>₹{successful.reduce((sum, order) => sum + order.amount, 0).toLocaleString("en-IN")}</strong></div>
          <div className="pending"><span>Pending</span><strong>{pending.length}</strong></div>
          <div className="failed"><span>Failed</span><strong>{failed.length}</strong></div>
        </div>
        <div className="admin-filter-shell">
          <label className="admin-order-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transaction, order, customer or mobile" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear transaction search"><X size={16} /></button> : null}
          </label>
          <label className="admin-select-filter">
            <span>Payment status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PaymentStateFilter)}>
              <option value="all">All statuses</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <DateFilterBar value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="payment-transactions-list">
          {visibleTransactions.map((order) => (
            <article className="payment-transaction-card" key={order.id}>
              <div className="payment-transaction-main">
                <span className={`payment-state-pill ${paymentState(order.paymentStatus)}`}>{paymentState(order.paymentStatus)}</span>
                <strong>₹{order.amount.toLocaleString("en-IN")}</strong>
                <span>{order.customerName} · {order.mobile}</span>
              </div>
              <div>
                <strong>{order.paymentReference ?? order.phonepePaymentId ?? `Order ${order.id.slice(0, 8)}`}</strong>
                <span>Order #{order.id}</span>
                <span>{formatAdminDate(order.createdAt)}</span>
              </div>
            </article>
          ))}
          {!visibleTransactions.length ? (
            <div className="admin-empty-state"><CreditCard size={25} /><strong>No matching transactions</strong><span>Change the date, payment status, search, or active gateway.</span></div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function ProductsPanel({
  form,
  products,
  uploadMessage,
  editingProductId,
  editorOpen,
  onDeleteProduct,
  onEditProduct,
  onFormChange,
  onResetForm,
  onSaveProduct,
  onToggleEditor,
  onUploadProductImage,
}: {
  form: ProductForm;
  products: Product[];
  uploadMessage: string;
  editingProductId: string;
  editorOpen: boolean;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (product: Product) => void;
  onFormChange: (form: ProductForm) => void;
  onResetForm: () => void;
  onSaveProduct: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleEditor: () => void;
  onUploadProductImage: (file: File) => Promise<void>;
}) {
  return (
    <section className="admin-panel" id="product-editor">
      <div className="panel-title panel-title-actions">
        <div>
          <PackageCheck size={20} />
          <h2>Products</h2>
        </div>
        <button className={editorOpen ? "secondary-button" : "primary-button"} type="button" onClick={onToggleEditor}>
          {editorOpen ? <X size={17} /> : <Plus size={17} />}
          {editorOpen ? "Close manager" : "Product & category management"}
        </button>
      </div>
      {editorOpen ? (
        <>
      <div className="admin-form-head">
        <div>
          <strong>{editingProductId ? "Edit product" : "Add new product"}</strong>
          <span>{editingProductId ? "Update product details, pricing, stock and media." : "Create a product with clear catalog details."}</span>
        </div>
        {editingProductId ? (
          <button className="secondary-button" type="button" onClick={onResetForm}>
            <Plus size={17} /> New product
          </button>
        ) : null}
      </div>
      <form className="admin-form" onSubmit={onSaveProduct}>
        <label className="admin-field">
          <span>Product name</span>
          <input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Example: Premium A5 custom notebook" required />
        </label>
        <label className="admin-field">
          <span>Category</span>
          <input value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value })} placeholder="Customized, Spiral, Hardbound..." />
        </label>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="admin-field">
            <span>Selling price (₹)</span>
            <input type="number" value={form.price} onChange={(event) => onFormChange({ ...form, price: Number(event.target.value) })} min={0} placeholder="199" />
          </label>
          <label className="admin-field">
            <span>Production cost (₹)</span>
            <input type="number" value={form.costPrice} onChange={(event) => onFormChange({ ...form, costPrice: Number(event.target.value) })} min={0} placeholder="Used for profit report" />
          </label>
          <label className="admin-field">
            <span>MRP / compare price (₹)</span>
            <input
              type="number"
              value={form.compareAtPrice ?? ""}
              onChange={(event) => onFormChange({ ...form, compareAtPrice: event.target.value ? Number(event.target.value) : null })}
              min={0}
              placeholder="249"
            />
          </label>
          <label className="admin-field">
            <span>Stock quantity</span>
            <input type="number" value={form.stock} onChange={(event) => onFormChange({ ...form, stock: Number(event.target.value) })} min={0} placeholder="How many in stock?" />
          </label>
        </div>
        <label className="admin-field">
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Short customer-facing product description" rows={3} />
        </label>
        <label className="admin-field">
          <span>Specifications</span>
          <textarea value={form.specs} onChange={(event) => onFormChange({ ...form, specs: event.target.value })} placeholder="One per line, like Size: A5" rows={5} />
        </label>
        <label className="admin-field">
          <span>Product image / video URLs</span>
          <textarea value={form.images} onChange={(event) => onFormChange({ ...form, images: event.target.value })} placeholder="Cloudinary URLs, one per line" rows={4} />
        </label>
        <label className="admin-upload">
          <input type="file" accept="image/*,video/*" onChange={(event) => event.target.files?.[0] && onUploadProductImage(event.target.files[0])} />
          <UploadCloud size={22} /> Upload product media to Cloudinary
        </label>
        <div className="admin-checks">
          <label><input type="checkbox" checked={form.isCustomizable} onChange={(event) => onFormChange({ ...form, isCustomizable: event.target.checked })} /> Customizable product</label>
          <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => onFormChange({ ...form, isFeatured: event.target.checked })} /> Show as featured</label>
        </div>
        <div className="admin-form-actions">
          <button className="primary-button justify-center" type="submit"><Save size={18} /> {editingProductId ? "Update product" : "Save product"}</button>
          {editingProductId ? (
            <button className="secondary-button justify-center" type="button" onClick={onResetForm}><RotateCcw size={17} /> Cancel edit</button>
          ) : null}
        </div>
        {uploadMessage ? <span className="form-status">{uploadMessage}</span> : null}
      </form>
        </>
      ) : null}

      <div className="admin-table">
        {products.map((product) => (
          <div className={`admin-row ${editingProductId === product.id ? "is-editing" : ""}`} key={product.id}>
            {product.images[0] ? <img src={product.images[0]} alt={product.name} /> : <span className="empty-thumb" />}
            <div>
              <strong>{product.name}</strong>
              <span>{product.category} · ₹{product.price} · {product.stock} in stock</span>
              {editingProductId === product.id ? <span className="product-editing-pill">Currently editing</span> : null}
            </div>
            <div className="admin-row-actions">
              <button className="icon-button" onClick={() => onEditProduct(product)} aria-label={`Edit ${product.name}`}><Pencil size={17} /></button>
              <button className="icon-button" onClick={() => onDeleteProduct(product.id)} aria-label={`Delete ${product.name}`}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SelectionToolbar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  busy,
  label,
  message,
  onToggleVisible,
  onDeleteSelected,
}: {
  selectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
  busy: boolean;
  label: string;
  message: string;
  onToggleVisible: () => void;
  onDeleteSelected: () => void;
}) {
  return (
    <div className="admin-selection-toolbar">
      <label>
        <input type="checkbox" checked={allVisibleSelected && visibleCount > 0} onChange={onToggleVisible} disabled={!visibleCount} />
        Select all {visibleCount} visible
      </label>
      <span>{selectedCount ? `${selectedCount} selected` : `Select ${label} to manage them together`}</span>
      <button className="admin-danger-button" type="button" disabled={!selectedCount || busy} onClick={onDeleteSelected}>
        <Trash2 size={16} /> {busy ? "Deleting..." : `Delete selected${selectedCount ? ` (${selectedCount})` : ""}`}
      </button>
      {message ? <p className="admin-selection-message">{message}</p> : null}
    </div>
  );
}

function CustomRequestsPanel({
  requests,
  onDeleteRequests,
}: {
  requests: CustomRequest[];
  onDeleteRequests: (ids: string[]) => Promise<DeleteResult>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(emptyDateFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const statuses = Array.from(new Set(requests.map((request) => request.status))).sort();
  const visibleRequests = requests.filter((request) => {
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesDate = dateMatches(request.createdAt, dateFilter);
    const matchesQuery = !normalizedQuery || [request.id, request.customerName, request.mobile, request.notes]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesDate && matchesQuery;
  });
  const visibleIds = visibleRequests.map((request) => request.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  async function removeRequests(ids: string[]) {
    if (!ids.length || !window.confirm(`Permanently delete ${ids.length} custom request${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleteBusy(true);
    setDeleteMessage("");
    const result = await onDeleteRequests(ids);
    setDeleteMessage(result.message);
    if (result.ok) setSelectedIds(new Set());
    setDeleteBusy(false);
  }

  return (
    <section className="admin-panel">
      <div className="panel-title">
        <ImagePlus size={20} />
        <h2>Custom notebook requests</h2>
      </div>
      <div className="admin-filter-shell">
        <label className="admin-order-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, mobile, request ID or notes" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear custom request search"><X size={16} /></button> : null}
        </label>
        <label className="admin-select-filter">
          <span>Request status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <DateFilterBar value={dateFilter} onChange={setDateFilter} />
      </div>
      <div className="admin-filter-result"><strong>{visibleRequests.length}</strong> of {requests.length} requests shown</div>
      <SelectionToolbar
        selectedCount={selectedIds.size}
        visibleCount={visibleIds.length}
        allVisibleSelected={allVisibleSelected}
        busy={deleteBusy}
        label="requests"
        message={deleteMessage}
        onToggleVisible={toggleVisible}
        onDeleteSelected={() => void removeRequests(Array.from(selectedIds))}
      />
      {visibleRequests.length ? (
        <div className="admin-record-table-wrap">
          <table className="admin-record-table custom-request-table">
            <thead>
              <tr><th aria-label="Select" /><th>Request</th><th>Customer</th><th>Details</th><th>Status & date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr className={selectedIds.has(request.id) ? "is-selected" : ""} key={request.id}>
                  <td><input type="checkbox" checked={selectedIds.has(request.id)} onChange={() => toggleSelected(request.id)} aria-label={`Select request ${request.id}`} /></td>
                  <td>
                    <div className="admin-record-media">
                      {request.imageUrl ? <img src={request.imageUrl} alt="" /> : <span className="empty-thumb"><ImagePlus size={18} /></span>}
                      <div><strong>#{request.id.slice(0, 8)}</strong><span>{request.quantity} notebook{request.quantity === 1 ? "" : "s"}</span></div>
                    </div>
                  </td>
                  <td><strong>{request.customerName}</strong><span>{request.mobile}</span></td>
                  <td className="admin-record-notes">{request.notes || "No additional notes"}</td>
                  <td><span className="admin-record-status">{request.status}</span><span>{formatAdminDate(request.createdAt)}</span></td>
                  <td><button className="admin-row-delete" type="button" onClick={() => void removeRequests([request.id])} disabled={deleteBusy} aria-label={`Delete request ${request.id}`}><Trash2 size={16} /> Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty-state"><ImagePlus size={25} /><strong>No matching custom requests</strong><span>Try another search, status, or calendar range.</span></div>
      )}
    </section>
  );
}

function OrdersPanel({
  orders,
  products,
  onDeleteOrders,
}: {
  orders: Order[];
  products: Product[];
  onDeleteOrders: (ids: string[]) => Promise<DeleteResult>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CanonicalOrderStatus>("all");
  const [gatewayFilter, setGatewayFilter] = useState<"all" | Order["paymentGateway"]>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(emptyDateFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || canonicalOrderStatus(order.deliveryStatus) === statusFilter;
    const matchesGateway = gatewayFilter === "all" || order.paymentGateway === gatewayFilter;
    const matchesDate = dateMatches(order.createdAt, dateFilter);
    const matchesQuery = !normalizedQuery || [order.id, order.mobile, order.customerName]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesGateway && matchesDate && matchesQuery;
  });
  const visibleIds = visibleOrders.map((order) => order.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  async function removeOrders(ids: string[]) {
    if (!ids.length || !window.confirm(`Permanently delete ${ids.length} order${ids.length === 1 ? "" : "s"}? This removes the records from the database and cannot be undone.`)) return;
    setDeleteBusy(true);
    setDeleteMessage("");
    const result = await onDeleteOrders(ids);
    setDeleteMessage(result.message);
    if (result.ok) setSelectedIds(new Set());
    setDeleteBusy(false);
  }

  return (
    <section className="admin-panel">
      <div className="panel-title">
        <ShoppingCart size={20} />
        <h2>Orders, notebooks and customer search</h2>
      </div>
      <label className="admin-order-search">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Order ID, mobile number or customer name" />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={17} /></button> : null}
      </label>
      <div className="admin-filter-shell compact">
        <label className="admin-select-filter">
          <span>Payment method</span>
          <select value={gatewayFilter ?? "all"} onChange={(event) => setGatewayFilter(event.target.value as "all" | Order["paymentGateway"])}>
            <option value="all">All payment methods</option>
            <option value="cod">Cash on Delivery</option>
            {gatewayOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            {orders.some((order) => order.paymentGateway === "razorpay") ? <option value="razorpay">Razorpay (historical)</option> : null}
          </select>
        </label>
        <DateFilterBar value={dateFilter} onChange={setDateFilter} />
      </div>
      <div className="order-filter-row">
        <button className={statusFilter === "all" ? "active" : ""} type="button" onClick={() => setStatusFilter("all")}>All <strong>{orders.length}</strong></button>
        {orderStatusMeta.map(({ value, label }) => (
          <button className={statusFilter === value ? `active ${value}` : value} type="button" onClick={() => setStatusFilter(value)} key={value}>
            {label} <strong>{orders.filter((order) => canonicalOrderStatus(order.deliveryStatus) === value).length}</strong>
          </button>
        ))}
      </div>
      <div className="admin-filter-result"><strong>{visibleOrders.length}</strong> of {orders.length} orders shown</div>
      <SelectionToolbar
        selectedCount={selectedIds.size}
        visibleCount={visibleIds.length}
        allVisibleSelected={allVisibleSelected}
        busy={deleteBusy}
        label="orders"
        message={deleteMessage}
        onToggleVisible={toggleVisible}
        onDeleteSelected={() => void removeOrders(Array.from(selectedIds))}
      />
      {visibleOrders.length ? (
        <div className="admin-record-table-wrap">
          <table className="admin-record-table orders-record-table">
            <thead>
              <tr><th aria-label="Select" /><th>Order & notebooks</th><th>Customer</th><th>Payment</th><th>Delivery</th><th>Total & date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr className={selectedIds.has(order.id) ? "is-selected" : ""} key={order.id}>
                  <td><input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelected(order.id)} aria-label={`Select order ${order.id}`} /></td>
                  <td>
                    <strong>#{order.id.slice(0, 8)}</strong>
                    <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {order.items.length} lines</span>
                    <details className="admin-row-details">
                      <summary>View ordered notebooks</summary>
                      <div className="admin-order-products compact-products">
                        {order.items.map((item, index) => (
                          <div className="admin-order-product" key={`${order.id}-${item.productId}-${index}`}>
                            {item.customArtworkUrl || item.imageUrl || products.find((product) => product.id === item.productId)?.images[0] ? (
                              <img src={item.customArtworkUrl ?? item.imageUrl ?? products.find((product) => product.id === item.productId)?.images[0] ?? ""} alt={item.name} />
                            ) : <span className="empty-thumb"><PackageCheck size={18} /></span>}
                            <div><strong>{item.quantity} × {item.name}</strong><span>₹{item.price} each</span>{item.customCoverName ? <span className="custom-order-detail">Print: {item.customCoverName}</span> : null}{item.customArtworkUrl ? <a href={item.customArtworkUrl} target="_blank" rel="noreferrer">Open artwork</a> : null}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                  <td><strong>{order.customerName}</strong><span>{order.mobile}</span><span className="admin-record-address">{order.address}</span></td>
                  <td><strong>{order.paymentGateway === "cod" ? "Cash on Delivery" : paymentGatewayLabelForAdmin(order.paymentGateway)}</strong><span className={`payment-state-pill ${paymentState(order.paymentStatus)}`}>{order.paymentStatus}</span>{order.paymentReference ? <span>Ref: {order.paymentReference}</span> : null}</td>
                  <td><span className={`order-state-pill ${canonicalOrderStatus(order.deliveryStatus)}`}>{canonicalOrderStatus(order.deliveryStatus) === "printing" ? "Printing / Processing" : canonicalOrderStatus(order.deliveryStatus)}</span><span>{formatProvider(order.deliveryProvider)}</span>{order.deliveryTrackingNumber ? <span>AWB: {order.deliveryTrackingNumber}</span> : null}</td>
                  <td><strong>₹{order.amount.toLocaleString("en-IN")}</strong><span>{formatAdminDate(order.createdAt)}</span></td>
                  <td><button className="admin-row-delete" type="button" onClick={() => void removeOrders([order.id])} disabled={deleteBusy} aria-label={`Delete order ${order.id}`}><Trash2 size={16} /> Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty-state"><Search size={25} /><strong>No matching orders</strong><span>Try another search, status, payment method, or calendar range.</span></div>
      )}
    </section>
  );
}

function DeliveryPanel({
  delhiverySettings,
  delhiverySettingsMessage,
  delhiverySettingsSaving,
  orders,
  products,
  onDelhiverySettingsChange,
  onDelhiverySettingsSave,
  onDeliverySaved,
  onDeleteOrders,
}: {
  delhiverySettings: DelhiverySettings;
  delhiverySettingsMessage: string;
  delhiverySettingsSaving: boolean;
  orders: Order[];
  products: Product[];
  onDelhiverySettingsChange: (settings: DelhiverySettings) => void;
  onDelhiverySettingsSave: () => Promise<void>;
  onDeliverySaved: () => Promise<void>;
  onDeleteOrders: (ids: string[]) => Promise<DeleteResult>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CanonicalOrderStatus>("all");
  const [providerFilter, setProviderFilter] = useState<"all" | DeliveryProvider>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(emptyDateFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === "all" || canonicalOrderStatus(order.deliveryStatus) === statusFilter;
    const matchesProvider = providerFilter === "all" || order.deliveryProvider === providerFilter;
    const matchesDate = dateMatches(order.createdAt, dateFilter);
    const matchesQuery = !normalizedQuery || [
      order.id,
      order.customerName,
      order.mobile,
      order.address,
      order.deliveryTrackingNumber ?? "",
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesStatus && matchesProvider && matchesDate && matchesQuery;
  });
  const visibleIds = visibleOrders.map((order) => order.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  async function removeOrders(ids: string[]) {
    if (!ids.length || !window.confirm(`Permanently delete ${ids.length} delivery order${ids.length === 1 ? "" : "s"}? This removes the complete order record and cannot be undone.`)) return;
    setDeleteBusy(true);
    setDeleteMessage("");
    const result = await onDeleteOrders(ids);
    setDeleteMessage(result.message);
    if (result.ok) setSelectedIds(new Set());
    setDeleteBusy(false);
  }

  return (
    <section className="admin-section-stack">
      <section className="admin-panel">
        <div className="panel-title">
          <PackageCheck size={20} />
          <h2>Delhivery shipment settings</h2>
        </div>
        <p className="delhivery-settings-note">
          These values are used whenever NoteKart creates a new Delhivery shipment. The pickup location must exactly match your registered Delhivery warehouse name.
        </p>
        <div className="delhivery-settings-form">
          <label>
            <span>Pickup location / warehouse name</span>
            <input
              value={delhiverySettings.pickupLocation}
              onChange={(event) => onDelhiverySettingsChange({
                ...delhiverySettings,
                pickupLocation: event.target.value,
              })}
              placeholder="Example: NoteKart"
            />
          </label>
          <label>
            <span>Default parcel weight (grams)</span>
            <input
              min={1}
              max={50_000}
              type="number"
              value={delhiverySettings.defaultWeightGrams}
              onChange={(event) => onDelhiverySettingsChange({
                ...delhiverySettings,
                defaultWeightGrams: Number(event.target.value),
              })}
            />
          </label>
          <button
            className="primary-button justify-center"
            type="button"
            disabled={delhiverySettingsSaving}
            onClick={onDelhiverySettingsSave}
          >
            {delhiverySettingsSaving ? "Saving..." : "Save Delhivery settings"}
          </button>
        </div>
        {delhiverySettingsMessage ? <span className="form-status">{delhiverySettingsMessage}</span> : null}
      </section>

      <section className="admin-panel">
        <div className="panel-title">
          <ShipWheel size={20} />
          <h2>Delivery assignment</h2>
        </div>
        <div className="admin-filter-shell">
          <label className="admin-order-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, mobile, address or AWB" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear delivery search"><X size={16} /></button> : null}
          </label>
          <div className="admin-filter-selects">
            <label className="admin-select-filter">
              <span>Delivery status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | CanonicalOrderStatus)}>
                <option value="all">All statuses</option>
                {orderStatusMeta.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="admin-select-filter">
              <span>Courier provider</span>
              <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as "all" | DeliveryProvider)}>
                <option value="all">All providers</option>
                {deliveryProviders.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <DateFilterBar value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="admin-filter-result"><strong>{visibleOrders.length}</strong> of {orders.length} delivery orders shown</div>
        <SelectionToolbar
          selectedCount={selectedIds.size}
          visibleCount={visibleIds.length}
          allVisibleSelected={allVisibleSelected}
          busy={deleteBusy}
          label="delivery orders"
          message={deleteMessage}
          onToggleVisible={toggleVisible}
          onDeleteSelected={() => void removeOrders(Array.from(selectedIds))}
        />
        {visibleOrders.length ? (
          <div className="admin-record-table-wrap">
            <table className="admin-record-table delivery-record-table">
              <thead>
                <tr><th aria-label="Select" /><th>Order</th><th>Customer & address</th><th>Shipment</th><th>Status</th><th>Manage delivery</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr className={selectedIds.has(order.id) ? "is-selected" : ""} key={order.id}>
                    <td><input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelected(order.id)} aria-label={`Select delivery order ${order.id}`} /></td>
                    <td>
                      <strong>#{order.id.slice(0, 8)}</strong>
                      <span>₹{order.amount.toLocaleString("en-IN")} · {order.items.length} lines</span>
                      <details className="admin-row-details"><summary>View notebooks</summary><div className="delivery-order-items">{order.items.map((item, index) => <div key={`${order.id}-${item.productId}-${index}`}>{item.customArtworkUrl || item.imageUrl || products.find((product) => product.id === item.productId)?.images[0] ? <img src={item.customArtworkUrl ?? item.imageUrl ?? products.find((product) => product.id === item.productId)?.images[0] ?? ""} alt={item.name} /> : <span className="empty-thumb" />}<span>{item.quantity} × {item.name}{item.customCoverName ? ` · ${item.customCoverName}` : ""}</span></div>)}</div></details>
                    </td>
                    <td><strong>{order.customerName}</strong><span>{order.mobile}</span><span className="admin-record-address">{order.address}</span></td>
                    <td><strong>{formatProvider(order.deliveryProvider)}</strong>{order.deliveryTrackingNumber ? <span>AWB: {order.deliveryTrackingNumber}</span> : <span>No AWB assigned</span>}<span>{order.paymentStatus} payment</span></td>
                    <td><span className={`order-state-pill ${canonicalOrderStatus(order.deliveryStatus)}`}>{canonicalOrderStatus(order.deliveryStatus) === "printing" ? "Printing / Processing" : canonicalOrderStatus(order.deliveryStatus)}</span><span>{formatAdminDate(order.createdAt)}</span></td>
                    <td className="delivery-manage-cell">
                      <details className="admin-row-details manage-details">
                        <summary>Update shipment</summary>
                        <div className="delivery-card-actions">
                          <DeliveryAssignmentForm order={order} onSaved={onDeliverySaved} />
                          {order.deliveryProvider === "delhivery" && order.deliveryTrackingNumber ? <DelhiveryTrackingCard admin orderId={order.id} waybill={order.deliveryTrackingNumber} /> : null}
                        </div>
                      </details>
                    </td>
                    <td><button className="admin-row-delete" type="button" onClick={() => void removeOrders([order.id])} disabled={deleteBusy} aria-label={`Delete order ${order.id}`}><Trash2 size={16} /> Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state"><ShipWheel size={25} /><strong>No matching delivery orders</strong><span>Try another search, status, provider, or calendar range.</span></div>
        )}
      </section>
    </section>
  );
}

function DeliveryAssignmentForm({ order, onSaved }: { order: Order; onSaved: () => Promise<void> }) {
  const [provider, setProvider] = useState<DeliveryProvider>(order.deliveryProvider ?? "review");
  const [trackingNumber, setTrackingNumber] = useState(order.deliveryTrackingNumber ?? "");
  const [deliveryStatus, setDeliveryStatus] = useState<string>(canonicalOrderStatus(order.deliveryStatus));
  const [deliveryNotes, setDeliveryNotes] = useState(order.deliveryNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/orders/${order.id}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, trackingNumber, deliveryStatus, deliveryNotes }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not save delivery.");
      setSaving(false);
      return;
    }
    if (data.trackingNumber) setTrackingNumber(data.trackingNumber);
    if (data.deliveryStatus) setDeliveryStatus(data.deliveryStatus);
    if (data.deliveryNotes) setDeliveryNotes(data.deliveryNotes);
    setMessage(data.trackingNumber ? `Delhivery AWB assigned: ${data.trackingNumber}` : "Delivery saved.");
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
        <option value="pending">Pending</option>
        <option value="printing">Printing / Processing</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <textarea value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} placeholder="Internal delivery notes" rows={2} />
      <button className="primary-button justify-center" disabled={saving} type="submit">{saving ? "Saving..." : "Save delivery"}</button>
      {message ? <span className="form-status">{message}</span> : null}
    </form>
  );
}

function formatProvider(provider?: DeliveryProvider | null) {
  return deliveryProviders.find((option) => option.value === provider)?.label ?? "Review first";
}

function paymentGatewayLabelForAdmin(gateway?: Order["paymentGateway"]) {
  if (gateway === "cod") return "Cash on Delivery";
  if (gateway === "razorpay") return "Razorpay (historical)";
  return gatewayOptions.find((option) => option.value === gateway)?.label ?? "Online payment";
}
