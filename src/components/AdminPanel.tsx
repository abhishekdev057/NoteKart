"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ImagePlus,
  IndianRupee,
  LayoutDashboard,
  LockKeyhole,
  PackageCheck,
  Save,
  ShipWheel,
  ShoppingCart,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CustomRequest, Order, Product } from "@/lib/types";

type Analytics = {
  productCount: number;
  stock: number;
  customRequestCount: number;
  orderCount: number;
  revenue: number;
};

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

export function AdminPanel() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [authorized, setAuthorized] = useState(false);
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

  async function login() {
    setLoginError("");
    const response = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, otp }),
    });
    const data = await response.json();
    if (!response.ok || data.user?.role !== "admin") {
      setLoginError(data.error ?? "Only registered admin mobile numbers can access this panel.");
      return;
    }
    await loadAdminData();
    setAuthorized(true);
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
    setTracking("Checking Shiprocket...");
    const response = await fetch("/api/shiprocket/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awb: trackingAwb }),
    });
    const data = await response.json();
    setTracking(JSON.stringify(data.tracking ?? data, null, 2));
  }

  if (!authorized) {
    return (
      <main className="admin-login">
        <section className="admin-login-card">
          <LockKeyhole size={34} />
          <h1>NoteKart Admin</h1>
          <p>Use admin mobile 9256308961 or 9461217285 with OTP 0000, 1111, 2222 and so on.</p>
          <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Admin mobile number" />
          <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Four digit OTP" maxLength={4} />
          <button className="primary-button justify-center" onClick={login}>Unlock admin panel</button>
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
        {["Dashboard", "Products", "Custom requests", "Orders", "Payments", "Shiprocket"].map((item) => (
          <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>
        ))}
      </aside>

      <section className="admin-main">
        <div className="admin-topbar">
          <div>
            <p>Admin console</p>
            <h1>Operations, inventory and custom notebook control</h1>
          </div>
          <Link href="/" className="secondary-button">Open storefront</Link>
        </div>

        <section id="dashboard" className="admin-grid">
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
        </section>

        <section className="admin-panel">
          <div className="panel-title">
            <BarChart3 size={20} />
            <h2>Reports and analysis</h2>
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

        <section id="products" className="admin-panel">
          <div className="panel-title">
            <PackageCheck size={20} />
            <h2>Product and category management</h2>
          </div>
          <form className="admin-form" onSubmit={saveProduct}>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" required />
            <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category" />
            <div className="grid gap-3 md:grid-cols-3">
              <input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} placeholder="Price" />
              <input type="number" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: Number(event.target.value) })} placeholder="MRP" />
              <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} placeholder="Stock" />
            </div>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" rows={3} />
            <textarea value={form.specs} onChange={(event) => setForm({ ...form, specs: event.target.value })} placeholder="Specifications, one per line as Key: Value" rows={5} />
            <textarea value={form.images} onChange={(event) => setForm({ ...form, images: event.target.value })} placeholder="Image URLs, one per line" rows={4} />
            <label className="admin-upload">
              <input type="file" accept="image/*,video/*" onChange={(event) => event.target.files?.[0] && uploadProductImage(event.target.files[0])} />
              <UploadCloud size={22} /> Upload product media to Cloudinary
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label><input type="checkbox" checked={form.isCustomizable} onChange={(event) => setForm({ ...form, isCustomizable: event.target.checked })} /> Customizable</label>
              <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} /> Featured</label>
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
                <button className="icon-button" onClick={() => deleteProduct(product.id)}><Trash2 size={17} /></button>
              </div>
            ))}
          </div>
        </section>

        <section id="custom-requests" className="admin-panel">
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

        <section id="orders" className="admin-panel">
          <div className="panel-title">
            <ShoppingCart size={20} />
            <h2>Orders, Razorpay and delivery</h2>
          </div>
          <div className="admin-table">
            {orders.map((order) => (
              <div className="admin-row" key={order.id}>
                <span className="empty-thumb" />
                <div>
                  <strong>{order.customerName} · ₹{order.amount}</strong>
                  <span>{order.paymentStatus} · {order.deliveryStatus} · {order.items.length} item lines</span>
                </div>
                <span className="admin-pill">{order.razorpayOrderId ?? "No payment id"}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="shiprocket" className="admin-panel">
          <div className="panel-title">
            <ShipWheel size={20} />
            <h2>Shiprocket tracking</h2>
          </div>
          <div className="track-box">
            <input value={trackingAwb} onChange={(event) => setTrackingAwb(event.target.value)} placeholder="Enter AWB code" />
            <button className="primary-button justify-center" onClick={trackShipment}>Track shipment</button>
          </div>
          {tracking ? <pre className="tracking-output">{tracking}</pre> : null}
        </section>
      </section>
    </main>
  );
}
