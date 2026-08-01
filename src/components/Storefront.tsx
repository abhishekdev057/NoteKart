"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";

const ThreeDNotebookCustomizer = dynamic(
  () => import("./ThreeDNotebookCustomizer"),
  { ssr: false }
);
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImagePlus,
  LockKeyhole,
  MapPin,
  Menu,
  Minus,
  NotebookPen,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Star,
  Truck,
  Upload,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import type { Order, Product, ProductReview } from "@/lib/types";

type CartItem = Product & {
  quantity: number;
  productId?: string;
  customArtworkUrl?: string | null;
  customCoverName?: string | null;
  customNotes?: string | null;
};
const CART_STORAGE_KEY = "notekart:guest-cart";
const CART_CHANGE_EVENT = "notekart:cart-change";
const EMPTY_CART: CartItem[] = [];
let cachedCartRaw = "";
let cachedCartSnapshot: CartItem[] = EMPTY_CART;

type CustomerUser = { mobile: string; role: string };
type Msg91VerifyData = Record<string, unknown>;
type CustomerOrder = Order;
type ServiceabilityState = {
  status: "idle" | "checking" | "serviceable" | "unserviceable" | "error";
  message: string;
};
type TrackingState = {
  loading?: boolean;
  message?: string;
  scans?: string[];
};

declare global {
  interface Window {
    initSendOTP?: (configuration: Record<string, unknown>) => void;
    sendOtp?: (identifier: string, success?: (data: unknown) => void, failure?: (error: unknown) => void) => void;
    retryOtp?: (channel: string | null, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
    verifyOtp?: (otp: string, success?: (data: unknown) => void, failure?: (error: unknown) => void, reqId?: string) => void;
    getWidgetData?: () => unknown;
    __notekartMsg91WidgetData?: unknown;
    Cashfree?: (config: { mode: "sandbox" | "production" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: "_self" | "_blank" | "_modal" }) => Promise<unknown>;
    };
  }
}

function readStoredCartSnapshot(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY) ?? "";
    if (stored === cachedCartRaw) return cachedCartSnapshot;
    cachedCartRaw = stored;

    if (!stored) {
      cachedCartSnapshot = EMPTY_CART;
      return cachedCartSnapshot;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      cachedCartSnapshot = EMPTY_CART;
      return cachedCartSnapshot;
    }

    cachedCartSnapshot = parsed.filter(
      (item): item is CartItem =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.price === "number" &&
        typeof item?.quantity === "number" &&
        item.quantity > 0,
    );
    return cachedCartSnapshot;
  } catch {
    cachedCartSnapshot = EMPTY_CART;
    return cachedCartSnapshot;
  }
}

function persistCart(cart: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

function subscribeCart(onStoreChange: () => void) {
  window.addEventListener(CART_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CART_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getServerCartSnapshot() {
  return EMPTY_CART;
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

function loadCashfreeSdk() {
  if (window.Cashfree) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cashfree SDK failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cashfree SDK failed to load."));
    document.body.appendChild(script);
  });
}

function QuantityStepper({
  label,
  quantity,
  onDecrease,
  onIncrease,
}: {
  label: string;
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button type="button" onClick={onDecrease} aria-label="Decrease quantity">
        <Minus size={15} />
      </button>
      <span>{quantity}</span>
      <button type="button" onClick={onIncrease} aria-label="Increase quantity">
        <Plus size={15} />
      </button>
    </div>
  );
}

function isCustomCartItem(item: CartItem) {
  return Boolean(item.customArtworkUrl || item.customCoverName || item.customNotes);
}

function orderPaymentLabel(status: string) {
  const value = status.toLowerCase();
  if (value === "cod_pending") return "Cash on Delivery";
  if (value === "paid") return "Payment successful";
  if (["failed", "cancelled", "amount_mismatch"].includes(value)) return "Payment issue";
  return "Payment pending";
}

function orderTone(status: string) {
  const value = status.toLowerCase();
  if (value === "paid" || value === "delivered" || value === "cod_pending") return "success";
  if (["failed", "cancelled", "amount_mismatch"].includes(value)) return "danger";
  return "pending";
}

function deliveryLabel(order: CustomerOrder) {
  if (order.deliveryStatus === "delivered") return "Delivered";
  if (order.deliveryStatus === "shipped") return "Shipped";
  if (["printing", "processing", "packed", "assigned"].includes(order.deliveryStatus)) return "Printing / Processing";
  if (order.deliveryStatus === "cancelled") return "Cancelled";
  return "Pending";
}

function providerLabel(provider?: string | null) {
  if (provider === "delhivery") return "Delhivery";
  if (provider === "post_office") return "Post Office";
  if (provider === "manual") return "Local/manual";
  return "Review first";
}

function formatOrderDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildOrderTimeline(order: CustomerOrder) {
  const isCod = order.paymentGateway === "cod";
  const paymentTone = orderTone(order.paymentStatus);
  const paymentConfirmed = order.paymentStatus === "paid" || isCod;
  const deliveryTone = order.deliveryStatus === "delivered" ? "success" : paymentConfirmed ? "pending" : "muted";
  return [
    {
      title: "Order placed",
      body: formatOrderDate(order.createdAt) || "Order created in NoteKart",
      tone: "success",
      icon: CheckCircle2,
    },
    {
      title: orderPaymentLabel(order.paymentStatus),
      body:
        isCod
          ? "Pay in cash when your NoteKart order arrives."
          : order.paymentStatus === "paid"
          ? `${order.paymentGateway ?? "payment"} reference ${order.paymentReference ?? order.phonepePaymentId ?? "saved"}`
          : "We will show success, failed, or cancelled here after gateway confirmation.",
      tone: paymentTone,
      icon: paymentTone === "danger" ? XCircle : paymentTone === "success" ? CheckCircle2 : Clock3,
    },
    {
      title: paymentConfirmed ? "Printing / Processing" : "Waiting for confirmed payment",
      body: paymentConfirmed ? "Notebook details are ready for printing, quality checks and packing." : "Production starts after payment is confirmed.",
      tone: paymentConfirmed ? "pending" : "muted",
      icon: AlertCircle,
    },
    {
      title: deliveryLabel(order),
      body: `${providerLabel(order.deliveryProvider)}${order.deliveryTrackingNumber ? ` · ${order.deliveryTrackingNumber}` : ""}`,
      tone: deliveryTone,
      icon: Truck,
    },
  ];
}

function extractTrackingScans(payload: unknown): string[] {
  const scans: string[] = [];
  const visit = (value: unknown) => {
    if (!value || scans.length > 8) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const text =
      record.scan_detail ??
      record.status ??
      record.current_status ??
      record.Instructions ??
      record.Scan ??
      record.scan;
    if (typeof text === "string" && text.trim()) scans.push(text.trim());
    Object.values(record).forEach(visit);
  };
  visit(payload);
  return Array.from(new Set(scans)).slice(0, 6);
}

export function Storefront({ products }: { products: Product[] }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const cart = useSyncExternalStore(subscribeCart, readStoredCartSnapshot, getServerCartSnapshot);
  const [selected, setSelected] = useState<Product>(products[0]);
  const [imageIndex, setImageIndex] = useState(0);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStage, setOtpStage] = useState<"mobile" | "code">("mobile");
  const [msg91ReqId, setMsg91ReqId] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState({
    customerName: "",
    line1: "",
    city: "Nawalgarh",
    state: "Rajasthan",
    pincode: "",
    landmark: "",
  });
  const [customFileUrl, setCustomFileUrl] = useState("");
  const [customCoverName, setCustomCoverName] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [customSubmitted, setCustomSubmitted] = useState(false);
  const [customizingProductId, setCustomizingProductId] = useState("custom-photo-journal");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("cod");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState("");
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, TrackingState>>({});
  const [serviceability, setServiceability] = useState<ServiceabilityState>({ status: "idle", message: "" });
  const { scrollYProgress } = useScroll();
  const heroLift = useTransform(scrollYProgress, [0, 0.35], [0, -90]);
  const heroTilt = useTransform(scrollYProgress, [0, 0.35], [0, -7]);

  useEffect(() => {
    // The session is an httpOnly cookie verified server-side; ask the server
    // who we are rather than trusting anything in the browser.
    let active = true;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => {
        if (active && data.user) setUser(data.user as CustomerUser);
      })
      .catch(() => {});
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

  useEffect(() => {
    const pincode = checkoutAddress.pincode;
    if (pincode.length !== 6) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      if (!active) return;
      setServiceability({ status: "checking", message: "Checking Delhivery availability..." });
      try {
        const response = await fetch(`/api/delhivery/serviceability?pincode=${pincode}`, { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        setServiceability({
          status: response.ok && data.serviceable ? "serviceable" : "unserviceable",
          message:
            data.message ??
            (response.ok
              ? "Delivery is available for this pincode."
              : "Your area is not serviceable right now. Please try another location."),
        });
      } catch {
        if (active) {
          setServiceability({
            status: "error",
            message: "Could not check delivery availability. Please retry.",
          });
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkoutAddress.pincode]);

  useEffect(() => {
    if (!selected?.id) return;
    let active = true;
    fetch(`/api/products/${selected.id}/reviews`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active) setReviews(data.reviews ?? []);
      })
      .catch(() => {
        if (active) setReviews([]);
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function getCartQuantity(productId: string) {
    return cart.find((item) => item.id === productId)?.quantity ?? 0;
  }

  function showProduct(product: Product) {
    if (product.id !== selected.id) {
      setSelected(product);
      setImageIndex(0);
      setReviews([]);
      setReviewsLoading(true);
      setReviewStatus("");
    }
  }

  function addToCart(product: Product, openCart = false) {
    const current = readStoredCartSnapshot();
    const existing = current.find((item) => item.id === product.id);
    const next = existing
      ? current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      : [...current, { ...product, quantity: 1 }];
    persistCart(next);
    if (openCart) setCartOpen(true);
  }

  function addCustomAlbumToCart({
    product,
    quantity,
    coverName,
    notes,
    artworkUrl,
  }: {
    product: Product;
    quantity: number;
    coverName: string;
    notes: string;
    artworkUrl: string;
  }) {
    const lineId = `custom:${product.id}:${Date.now()}`;
    const customItem: CartItem = {
      ...product,
      id: lineId,
      productId: product.id,
      name: coverName ? `A4 Photo Album - ${coverName}` : "A4 Custom Photo Album",
      specs: { ...product.specs, Size: "A4" },
      images: [artworkUrl, ...product.images].filter(Boolean),
      quantity,
      customArtworkUrl: artworkUrl,
      customCoverName: coverName || null,
      customNotes: notes || null,
    };
    persistCart([...readStoredCartSnapshot(), customItem]);
    setCartOpen(true);
  }

  function updateQuantity(id: string, delta: number) {
    const current = readStoredCartSnapshot();
    const next = current
      .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
      .filter((item) => item.quantity > 0);
    persistCart(next);
  }

  function continueShopping() {
    setCartOpen(false);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function requestOtp() {
    setAuthMessage("");
    setAuthBusy(true);
    try {
      if (msg91WidgetConfigured()) {
        if (!window.sendOtp) {
          setAuthMessage("MSG91 OTP is loading. Please try again in a moment.");
          return;
        }
        const sendData = await new Promise<unknown>((resolve, reject) => {
          window.sendOtp?.(msg91Identifier(mobile), (data) => resolve(data), (error) => reject(error));
        });
        rememberMsg91WidgetData(sendData);
        setMsg91ReqId(extractMsg91ReqId(sendData));
        setOtpStage("code");
        setAuthMessage("OTP sent to your mobile.");
        return;
      }

      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error ?? "Could not send OTP.");
        return;
      }
      setOtpStage("code");
      setAuthMessage(data.devCode ? `Dev OTP: ${data.devCode}` : data.message ?? "OTP sent to your mobile.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyOtp() {
    setAuthMessage("");
    setAuthBusy(true);
    try {
      if (msg91WidgetConfigured()) {
        if (!window.verifyOtp) {
          setAuthMessage("MSG91 OTP is still loading. Please try again.");
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
          setAuthMessage("MSG91 verified OTP but did not return an access token.");
          return;
        }
        const sessionResponse = await fetch("/api/auth/msg91-widget/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, accessToken }),
        });
        const sessionData = await sessionResponse.json();
        if (!sessionResponse.ok) {
          setAuthMessage(sessionData.error ?? "Could not create NoteKart session.");
          return;
        }
        setUser(sessionData.user);
        setOtp("");
        setOtpStage("mobile");
        if (sessionData.user.role === "admin") {
          setAuthMessage("Admin number verified. Use the private admin panel.");
        } else {
          setAuthMessage("You are logged in.");
          setAuthOpen(false);
        }
        return;
      }

      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code: otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(data.error ?? "Verification failed.");
        return;
      }
      setUser(data.user);
      setOtp("");
      setOtpStage("mobile");
      if (data.user.role === "admin") {
        setAuthMessage("Admin number verified. Use the private admin panel.");
      } else {
        setAuthMessage("You are logged in.");
        setAuthOpen(false);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setOrders([]);
    setOrdersOpen(false);
    setOtpStage("mobile");
    setOtp("");
    setAuthMessage("You are logged out.");
  }

  async function loadCustomerOrders() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOrdersLoading(true);
    setOrdersMessage("");
    try {
      const response = await fetch("/api/orders/me", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setOrdersMessage(data.error ?? "Could not load your orders.");
        return;
      }
      setOrders(data.orders ?? []);
    } catch {
      setOrdersMessage("Could not connect to your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }

  function openOrders() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOrdersOpen(true);
    void loadCustomerOrders();
  }

  async function checkDeliveryAvailabilityNow(pincode: string) {
    setServiceability({ status: "checking", message: "Checking Delhivery availability..." });
    try {
      const response = await fetch(`/api/delhivery/serviceability?pincode=${pincode}`, { cache: "no-store" });
      const data = await response.json();
      const next: ServiceabilityState = {
        status: response.ok && data.serviceable ? "serviceable" : "unserviceable",
        message:
          data.message ??
          (response.ok
            ? "Delivery is available for this pincode."
            : "Your area is not serviceable right now. Please try another location."),
      };
      setServiceability(next);
      return next.status === "serviceable";
    } catch {
      setServiceability({ status: "error", message: "Could not check delivery availability. Please retry." });
      return false;
    }
  }

  async function loadOrderTracking(orderId: string) {
    setTrackingByOrder((current) => ({ ...current, [orderId]: { loading: true, message: "Checking latest Delhivery tracking..." } }));
    try {
      const response = await fetch(`/api/orders/${orderId}/tracking`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setTrackingByOrder((current) => ({ ...current, [orderId]: { message: data.error ?? "Could not load tracking." } }));
        return;
      }
      const scans = extractTrackingScans(data.tracking);
      setTrackingByOrder((current) => ({
        ...current,
        [orderId]: {
          message: scans.length ? "Latest Delhivery updates" : "Tracking is assigned. Detailed scans will appear after courier movement.",
          scans,
        },
      }));
    } catch {
      setTrackingByOrder((current) => ({ ...current, [orderId]: { message: "Could not connect to tracking service." } }));
    }
  }

  function formattedAddress() {
    return [
      checkoutAddress.line1,
      checkoutAddress.landmark ? `Landmark: ${checkoutAddress.landmark}` : "",
      checkoutAddress.city,
      checkoutAddress.state,
      checkoutAddress.pincode,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  async function uploadCustomFile(file: File) {
    setCustomSubmitted(false);
    setCustomStatus("Uploading artwork...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) {
      setCustomStatus(data.error ?? "Upload failed.");
      return;
    }
    setCustomFileUrl(data.url);
    setCustomStatus("Artwork uploaded. Send the request below.");
  }

  async function submitCustomRequest(formData: FormData) {
    const coverName = String(formData.get("coverName") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const quantity = Number(formData.get("quantity") || 1);
    if (!customFileUrl) {
      setCustomStatus("Please upload a cover photo before adding the customized notebook to cart.");
      return;
    }
    setCustomStatus("Sending request...");
    const response = await fetch("/api/custom-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: formData.get("customerName"),
        mobile: formData.get("mobile"),
        quantity,
        notes: [coverName ? `Cover name: ${coverName}` : "", notes].filter(Boolean).join("\n"),
        imageUrl: customFileUrl,
      }),
    });
    if (!response.ok) {
      setCustomStatus("Could not send request.");
      return;
    }

    const customProduct =
      products.find((product) => product.id === customizingProductId) ??
      products.find((product) => product.isCustomizable) ??
      products[0];
    if (customProduct) {
      addCustomAlbumToCart({
        product: customProduct,
        quantity,
        coverName,
        notes,
        artworkUrl: customFileUrl,
      });
    }

    setCustomFileUrl("");
    setCustomCoverName("");
    setCustomSubmitted(true);
    setCustomStatus("Custom album added to cart. Continue to payment from cart.");
  }

  async function checkout() {
    if (!cart.length) return;
    if (!user) {
      setCheckoutMessage("Login is required before checkout.");
      setAuthOpen(true);
      return;
    }
    if (!checkoutAddress.customerName.trim() || !checkoutAddress.line1.trim() || checkoutAddress.pincode.trim().length < 6) {
      setCheckoutMessage("Please fill your name, full address, and 6 digit pincode.");
      return;
    }
    const canDeliver = await checkDeliveryAvailabilityNow(checkoutAddress.pincode);
    if (!canDeliver) {
      setCheckoutMessage("Your area is not serviceable right now. Please try another location before checkout.");
      return;
    }
    setCheckoutMessage("Creating your order...");

    // 1. Create the order server-side. The server prices it from the catalog —
    //    the client never sends an amount.
    const orderResponse = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: checkoutAddress.customerName.trim(),
        address: formattedAddress(),
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.productId ?? item.id,
          quantity: item.quantity,
          customArtworkUrl: item.customArtworkUrl ?? null,
          customCoverName: item.customCoverName ?? null,
          customNotes: item.customNotes ?? null,
        })),
      }),
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) {
      setCheckoutMessage(order.error ?? "Could not create your order.");
      return;
    }

    if (paymentMethod === "cod") {
      persistCart([]);
      setCheckoutMessage(`Order #${String(order.id).slice(0, 8)} confirmed with Cash on Delivery. Estimated delivery: 4–7 days.`);
      void loadCustomerOrders();
      return;
    }

    // 2. Start payment for that order; the amount is taken from the stored order.
    setCheckoutMessage("Creating payment...");
    const paymentResponse = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      setCheckoutMessage(payment.error ?? "Could not start the payment.");
      return;
    }

    if (payment.gateway === "cashfree" && payment.paymentSessionId) {
      setCheckoutMessage("Opening Cashfree checkout...");
      try {
        await loadCashfreeSdk();
        const cashfree = window.Cashfree?.({ mode: payment.mode === "production" ? "production" : "sandbox" });
        await cashfree?.checkout({ paymentSessionId: payment.paymentSessionId, redirectTarget: "_self" });
      } catch {
        setCheckoutMessage("Cashfree checkout could not open. Please try again.");
      }
      return;
    }

    if (payment.redirectUrl) {
      window.location.href = payment.redirectUrl;
      return;
    }
    setCheckoutMessage(
      payment.mock
        ? `Demo ${payment.label ?? "payment"} order ${payment.paymentReference ?? ""} created. Add gateway credentials to enable live checkout.`
        : `${payment.label ?? "Payment"} created.`,
    );
  }

  async function submitReview(formData: FormData) {
    if (!user) {
      setReviewStatus("Login with your mobile number to write a review.");
      setAuthOpen(true);
      return;
    }
    setReviewStatus("Saving your review...");
    const response = await fetch(`/api/products/${selected.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: reviewRating,
        title: formData.get("title"),
        comment: formData.get("comment"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setReviewStatus(data.error ?? "Could not save your review.");
      return;
    }
    const refreshed = await fetch(`/api/products/${selected.id}/reviews`, { cache: "no-store" }).then((result) => result.json());
    setReviews(refreshed.reviews ?? []);
    setReviewStatus("Thank you—your review is now live.");
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-black/10 bg-[rgba(250,247,238,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <a href="#" className="flex items-center gap-3 font-semibold">
            <span className="grid size-10 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
              <NotebookPen size={21} />
            </span>
            <span className="text-lg tracking-tight">NoteKart</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-black/70 md:flex">
            <a href="#products">Products</a>
            <a href="#custom">Customize</a>
            <a href="#reviews">Reviews</a>
            <a href="#about">About us</a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="icon-button hidden md:grid" aria-label="Search">
              <Search size={18} />
            </button>
            <button className="icon-button" aria-label="Account" onClick={() => setAuthOpen(true)}>
              <UserRound size={18} />
            </button>
            {user ? (
              <button className="icon-button" aria-label="My orders" onClick={openOrders}>
                <Boxes size={18} />
              </button>
            ) : null}
            <button className="cart-button" onClick={() => setCartOpen(true)}>
              <ShoppingBag size={18} />
              <span>{cartCount}</span>
            </button>
            <button className="icon-button md:hidden" aria-label="Menu" onClick={() => setMobileNavOpen(true)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <section className="hero-section relative overflow-hidden px-4 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative z-10">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--teal)]">
              <MapPin size={16} /> Ward no. 11, Doomra, Nawalgarh
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
              Notebooks made for real notes, real classes, real memories.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-black/68 md:text-lg">
              Premium school notebooks, coaching supplies, office stationery and A4 photo albums crafted by NoteKart in Doomra, Jhunjhunu.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a className="primary-button" href="#products">
                Shop notebooks <ArrowRight size={18} />
              </a>
              <a className="secondary-button" href="#custom">
                A4 photo album <NotebookPen size={18} />
              </a>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["80 GSM", "smooth paper"],
                ["1 pc", "custom MOQ"],
                ["Local", "Doomra unit"],
              ].map(([value, label]) => (
                <div className="metric" key={value}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <motion.div style={{ y: heroLift, rotateX: heroTilt }} className="hero-stage">
            <Image
              className="hero-product-visual"
              src="/notekart-hero-notebooks.webp"
              alt="Colorful science, cricket and nature notebooks with realistic printed textures"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 52vw"
            />
            <div className="floating-card top-8 right-0">
              <Smartphone size={18} />
              Secure checkout
            </div>
            <div className="floating-card bottom-8 left-0">
              <Boxes size={18} />
              Tracked delivery
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/62 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto">
          {categories.map((category) => (
            <button className="category-chip" key={category}>
              {category}
            </button>
          ))}
        </div>
      </section>

      <section id="products" className="px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="section-heading">
            <h2>Notebook portfolio</h2>
            <p>Browse finishes, paper details, and album-ready custom products before adding them to cart.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {products.map((product) => (
              <article
                className="product-card"
                key={product.id}
                onMouseEnter={() => {
                  showProduct(product);
                }}
              >
                <button className="product-media" onClick={() => showProduct(product)} aria-label={`View ${product.name}`}>
                  <img src={product.images[0]} alt={product.name} />
                </button>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--teal)]">{product.category}</p>
                    <h3>{product.name}</h3>
                  </div>
                  <strong>₹{product.price}</strong>
                </div>
                <p>{product.description}</p>
                {getCartQuantity(product.id) > 0 ? (
                  <QuantityStepper
                    label={`${product.name} quantity`}
                    quantity={getCartQuantity(product.id)}
                    onDecrease={() => updateQuantity(product.id, -1)}
                    onIncrease={() => addToCart(product)}
                  />
                ) : (
                  <button className="product-action" onClick={() => addToCart(product)}>
                    Add to cart <Plus size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-6 rounded-lg border border-black/10 bg-white/72 p-4 shadow-[0_28px_90px_rgba(24,20,14,0.08)] md:grid-cols-[1.1fr_0.9fr] md:p-6">
            <div className="zoom-frame">
              <img src={selected.images[imageIndex] ?? selected.images[0]} alt={selected.name} />
              <button className="image-nav left-3" onClick={() => setImageIndex((imageIndex + selected.images.length - 1) % selected.images.length)}>
                <ChevronLeft size={18} />
              </button>
              <button className="image-nav right-3" onClick={() => setImageIndex((imageIndex + 1) % selected.images.length)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="product-detail">
              <p className="text-sm font-semibold text-[var(--saffron)]">{selected.category}</p>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>
              <div className="delivery-estimate">
                <Truck size={19} />
                <div>
                  <strong>Estimated delivery: 4–7 days</strong>
                  <span>Delivery time may vary slightly by pincode.</span>
                </div>
              </div>
              <div className="spec-grid">
                {Object.entries(selected.specs).map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {getCartQuantity(selected.id) > 0 ? (
                <div className="detail-cart-row">
                  <QuantityStepper
                    label={`${selected.name} quantity`}
                    quantity={getCartQuantity(selected.id)}
                    onDecrease={() => updateQuantity(selected.id, -1)}
                    onIncrease={() => addToCart(selected)}
                  />
                  <button className="secondary-button justify-center" onClick={() => setCartOpen(true)}>
                    Continue to cart <ShoppingBag size={18} />
                  </button>
                </div>
              ) : (
                <button className="primary-button w-full justify-center" onClick={() => addToCart(selected)}>
                  Add selected notebook <ShoppingBag size={18} />
                </button>
              )}
            </div>
          </div>

          <section className="reviews-shell" id="reviews">
            <div className="reviews-summary">
              <p>Customer reviews & ratings</p>
              <div className="rating-score">
                <strong>
                  {reviews.length
                    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
                    : "New"}
                </strong>
                <div>
                  <div className="stars" aria-label={`${reviews.length ? "Average customer rating" : "No ratings yet"}`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={18} fill={reviews.length && star <= Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <span>{reviews.length} rating{reviews.length === 1 ? "" : "s"} for {selected.name}</span>
                </div>
              </div>
              <p className="review-note">Real feedback helps students choose the right notebook.</p>
            </div>
            <div className="reviews-content">
              <div className="review-list">
                {reviewsLoading ? <p>Loading customer reviews...</p> : reviews.length ? reviews.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="review-card-head">
                      <div>
                        <strong>{review.customerName}</strong>
                        {review.isVerifiedPurchase ? <span className="verified-review"><BadgeCheck size={14} /> Verified purchase</span> : null}
                      </div>
                      <div className="stars small">
                        {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} fill={star <= review.rating ? "currentColor" : "none"} />)}
                      </div>
                    </div>
                    <h4>{review.title}</h4>
                    <p>{review.comment}</p>
                  </article>
                )) : (
                  <div className="empty-reviews">
                    <Star size={25} />
                    <strong>Be the first to review this notebook</strong>
                    <span>Share print, paper and cover quality details with other students.</span>
                  </div>
                )}
              </div>
              <form action={submitReview} className="review-form">
                <strong>Write a review</strong>
                <span>Your review is linked to your verified mobile login.</span>
                <div className="review-rating-picker" aria-label="Choose rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button type="button" key={star} onClick={() => setReviewRating(star)} aria-label={`${star} star rating`}>
                      <Star size={23} fill={star <= reviewRating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <input name="title" placeholder="Review title" minLength={2} maxLength={100} required />
                <textarea name="comment" placeholder="How was the cover print, paper and binding?" minLength={10} maxLength={1200} rows={4} required />
                <button className="primary-button justify-center" type="submit">Submit review <ArrowRight size={17} /></button>
                {reviewStatus ? <span className="form-status">{reviewStatus}</span> : null}
              </form>
            </div>
          </section>
        </div>
      </section>

      <section id="custom" className="custom-band px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2>A4 photo albums made from your best picture.</h2>
            <p>
              Upload artwork, add a printed cover name if you want, then checkout like a normal product.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Photo covers", "Logo notebooks", "Batch sets", "Matte/gloss finish"].map((item) => (
                <div className="check-row" key={item}>
                  <Check size={17} /> {item}
                </div>
              ))}
            </div>
          </div>
          {customSubmitted ? (
            <div className="custom-success">
              <div className="custom-success-icon">
                <Check size={30} />
              </div>
              <h3>Album added</h3>
              <p>Your A4 photo album is in cart. Complete address and payment from the cart to confirm production.</p>
              <button
                className="primary-button justify-center"
                type="button"
                onClick={() => {
                  setCustomSubmitted(false);
                  setCustomStatus("");
                }}
              >
                Add another album <Plus size={18} />
              </button>
            </div>
          ) : (
            <form action={submitCustomRequest} className="custom-form">
              <div className="grid gap-2 mb-2">
                <label className="text-xs font-semibold text-[rgba(250,247,238,0.78)]">Select notebook to customize:</label>
                <select
                  value={customizingProductId}
                  onChange={(e) => setCustomizingProductId(e.target.value)}
                  className="w-full border border-[rgba(250,247,238,0.14)] p-3.5 bg-white/10 text-white rounded-lg focus:outline-none focus:border-[var(--teal)] focus:ring-1 focus:ring-[var(--teal)] transition-all font-semibold"
                >
                  <option value="custom-photo-journal" className="bg-[#17130f] text-white">A4 Custom Photo Album (₹199)</option>
                  <option value="classic-a5-hardbound" className="bg-[#17130f] text-white">Classic A5 Hardbound Notebook (₹249)</option>
                </select>
              </div>
              {customFileUrl ? (
                <div className="relative w-full rounded-lg overflow-hidden border border-black/10">
                  <ThreeDNotebookCustomizer productId={customizingProductId} artworkUrl={customFileUrl} coverName={customCoverName} />
                  <div className="upload-preview-overlay z-10">
                    <Check size={18} />
                    <span>Artwork uploaded</span>
                  </div>
                  <button
                    className="upload-remove z-10"
                    type="button"
                    onClick={() => {
                      setCustomFileUrl("");
                      setCustomStatus("Artwork removed. Upload a new cover photo or logo.");
                    }}
                  >
                    Remove
                  </button>
                  <label className="upload-replace z-10 cursor-pointer" htmlFor="custom-artwork-upload">
                    Replace artwork
                  </label>
                  <input
                    id="custom-artwork-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadCustomFile(file);
                    }}
                  />
                </div>
              ) : (
                <div className="upload-zone">
                  <input
                    id="custom-artwork-upload"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadCustomFile(file);
                    }}
                  />
                  <label className="upload-prompt" htmlFor="custom-artwork-upload">
                    <ImagePlus size={30} />
                    <span>Upload cover photo or logo</span>
                    <small>PNG, JPG or WebP</small>
                  </label>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="customerName" placeholder="Your name" required />
                <input name="mobile" placeholder="Mobile number" required />
              </div>
              <input
                name="coverName"
                value={customCoverName}
                onChange={(event) => setCustomCoverName(event.target.value.slice(0, 40))}
                placeholder="Name to print on photo cover (optional)"
              />
              <input name="quantity" type="number" min="1" defaultValue="1" placeholder="Quantity" />
              <textarea name="notes" placeholder="Cover idea, notebook size, paper type, delivery details" rows={4} />
              <button className="primary-button justify-center" type="submit">
                Add to cart and pay <Upload size={18} />
              </button>
              {customStatus ? <p className="form-status">{customStatus}</p> : null}
            </form>
          )}
        </div>
      </section>

      <section id="about" className="about-section px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="about-kicker">The Story of NoteKart</div>
          <h2>From a Small Village to Students Across India</h2>
          <div className="about-story">
            <article>
              <h3>A Dream Started Here</h3>
              <p>NoteKart is not just a notebook brand. It is the story of a dream, hard work, and believing that even a small idea can create something big.</p>
              <p>My name is Anuj, and I am a 17-year-old student from Domra, Nawalgarh, Jhunjhunu, Rajasthan. Like every student, I used to buy notebooks every year. But every notebook looked the same. I wanted something different—something that could show my own style and personality.</p>
              <blockquote>“Why should notebooks be boring when they can be personal?”</blockquote>
              <p>That one simple question became the beginning of NoteKart.</p>
            </article>
            <article>
              <h3>The First Step</h3>
              <p>I didn&apos;t start with a big office. I didn&apos;t have a big investment. I didn&apos;t have a team. I started from my home with one goal—to make notebooks that students would feel proud to carry.</p>
              <p>Every order, every design, and every customer gave me the confidence to keep moving forward.</p>
            </article>
            <article>
              <h3>Made for Every Student</h3>
              <p>At NoteKart, we believe every notebook should feel special. Whether you love Anime, Cars, Bikes, Cricket, Motivation, Nature, Photography, or your own memories, we turn your ideas into a notebook that is truly yours.</p>
              <p>Every cover is printed with care because we know it is more than just a notebook—it is something you carry every day.</p>
            </article>
            <article>
              <h3>Quality Comes First</h3>
              <p>We never believe in shortcuts. Every notebook is carefully checked before shipping—from printing quality to paper quality—because your trust is more valuable than any order.</p>
            </article>
            <article>
              <h3>Growing Every Day</h3>
              <p>NoteKart is still a small startup, but every single customer helps us grow. Every order tells us that our dream is reaching another student somewhere in India.</p>
              <p>Your support is not just helping a business. It is helping a young student build his dream.</p>
            </article>
            <article>
              <h3>Our Mission</h3>
              <p>Our mission is simple: to make high-quality, affordable, and fully customized notebooks available to every student in India.</p>
              <p>We want students to feel excited every time they open their notebooks, because learning becomes even more enjoyable when something is truly your own.</p>
            </article>
          </div>
          <div className="about-thanks">
            <BadgeCheck size={27} />
            <div>
              <h3>Thank You</h3>
              <p>If you have ever placed an order, shared our page, or recommended NoteKart—thank you. You are not just our customer. You are a part of our journey.</p>
              <p>Together, let&apos;s build something that started from a small village and reaches students across India. Welcome to the NoteKart Family. ❤️</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 text-sm text-black/62 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <strong className="text-[var(--ink)]">NoteKart, Ward no. 11, Doomra, Nawalgarh, Jhunjhunu</strong>
            <span className="mt-1 block">Notebooks, custom covers, school and business stationery.</span>
          </div>
          <div className="policy-links">
            <a href="/terms-and-conditions">Terms</a>
            <a href="/refund-policy">Refunds</a>
            <a href="/privacy-policy">Privacy</a>
            <a href="/return-policy">Returns</a>
            <a href="/shipping-policy">Shipping</a>
            <a href="#about">About us</a>
          </div>
        </div>
      </footer>

      {cartCount > 0 ? (
        <div className="sticky-cart-bar">
          <div>
            <strong>{cartCount} item{cartCount === 1 ? "" : "s"} in cart</strong>
            <span>₹{total} total</span>
          </div>
          <button className="secondary-button" onClick={continueShopping}>
            Continue shopping
          </button>
          <button className="primary-button" onClick={() => setCartOpen(true)}>
            Continue to cart <ShoppingBag size={18} />
          </button>
        </div>
      ) : null}

      {cartOpen ? (
        <aside className="drawer">
          <button className="drawer-backdrop" onClick={() => setCartOpen(false)} aria-label="Close cart" />
          <div className="drawer-panel cart-drawer-panel">
            <div className="drawer-head">
              <h2>Cart</h2>
              <button className="icon-button" onClick={() => setCartOpen(false)}><X size={18} /></button>
            </div>
            <div className="cart-items-scroll space-y-3">
              {cart.length ? (
                cart.map((item) => (
                  <div className="cart-row" key={item.id}>
                    <img src={item.images[0]} alt={item.name} />
                    <div>
                      <strong>{item.name}</strong>
                      <span>₹{item.price} each</span>
                      {isCustomCartItem(item) ? (
                        <span className="cart-custom-note">
                          {item.customCoverName ? `Cover name: ${item.customCoverName}` : "A4 custom photo album"}
                        </span>
                      ) : null}
                    </div>
                    <QuantityStepper
                      label={`${item.name} cart quantity`}
                      quantity={item.quantity}
                      onDecrease={() => updateQuantity(item.id, -1)}
                      onIncrease={() => updateQuantity(item.id, 1)}
                    />
                  </div>
                ))
              ) : (
                <div className="empty-cart">
                  <ShoppingBag size={28} />
                  <strong>Your cart is empty</strong>
                  <span>Add notebooks or customized covers to continue.</span>
                </div>
              )}
            </div>
            <div className="cart-checkout-panel">
              <div className="mb-4 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
              <div className="cart-actions">
                <button className="secondary-button justify-center" onClick={continueShopping}>
                  Continue shopping
                </button>
                {user ? (
                  <form className="checkout-address-form" onSubmit={(event) => event.preventDefault()}>
                    <div className="checkout-user">
                      <Check size={17} />
                      <span>Logged in as {user.mobile}</span>
                    </div>
                    <input
                      value={checkoutAddress.customerName}
                      onChange={(event) => setCheckoutAddress({ ...checkoutAddress, customerName: event.target.value })}
                      placeholder="Full name"
                      required
                    />
                    <textarea
                      value={checkoutAddress.line1}
                      onChange={(event) => setCheckoutAddress({ ...checkoutAddress, line1: event.target.value })}
                      placeholder="House / street / area address"
                      rows={3}
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={checkoutAddress.city}
                        onChange={(event) => setCheckoutAddress({ ...checkoutAddress, city: event.target.value })}
                        placeholder="City"
                        required
                      />
                      <input
                        value={checkoutAddress.state}
                        onChange={(event) => setCheckoutAddress({ ...checkoutAddress, state: event.target.value })}
                        placeholder="State"
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={checkoutAddress.pincode}
                        onChange={(event) => {
                          const pincode = event.target.value.replace(/\D/g, "").slice(0, 6);
                          setCheckoutAddress({ ...checkoutAddress, pincode });
                          if (pincode.length < 6) setServiceability({ status: "idle", message: "" });
                        }}
                        placeholder="Pincode"
                        inputMode="numeric"
                        required
                      />
                      <input
                        value={checkoutAddress.landmark}
                        onChange={(event) => setCheckoutAddress({ ...checkoutAddress, landmark: event.target.value })}
                        placeholder="Landmark optional"
                      />
                    </div>
                    {serviceability.message ? (
                      <div className={`serviceability-message ${serviceability.status}`}>
                        {serviceability.status === "serviceable" ? <CheckCircle2 size={17} /> : serviceability.status === "checking" ? <Clock3 size={17} /> : <XCircle size={17} />}
                        <span>{serviceability.message}</span>
                      </div>
                    ) : null}
                    {serviceability.status === "unserviceable" ? (
                      <p className="delivery-retry-text">Try another pincode or delivery location to continue checkout.</p>
                    ) : null}
                    <div className="checkout-delivery-note">
                      <Truck size={18} /> <span><strong>Estimated delivery:</strong> 4–7 days</span>
                    </div>
                    <div className="payment-methods">
                      <button className={paymentMethod === "cod" ? "active" : ""} type="button" onClick={() => setPaymentMethod("cod")}>
                        <Banknote size={20} />
                        <span><strong>Cash on Delivery</strong><small>Pay when the order arrives</small></span>
                      </button>
                      <button className={paymentMethod === "online" ? "active" : ""} type="button" onClick={() => setPaymentMethod("online")}>
                        <LockKeyhole size={20} />
                        <span><strong>Pay online</strong><small>Secure UPI / card checkout</small></span>
                      </button>
                    </div>
                    <button
                      className="primary-button justify-center place-order-button"
                      onClick={checkout}
                      disabled={!cart.length || ["checking", "unserviceable"].includes(serviceability.status)}
                    >
                      {paymentMethod === "cod" ? "Place COD order" : "Proceed to secure payment"} <ArrowRight size={18} />
                    </button>
                  </form>
                ) : (
                  <div className="checkout-login-gate">
                    <LockKeyhole size={22} />
                    <strong>Login required</strong>
                    <span>Please verify your mobile number before placing the order.</span>
                    <button className="primary-button justify-center" onClick={() => setAuthOpen(true)}>
                      Login with OTP <UserRound size={18} />
                    </button>
                  </div>
                )}
              </div>
              {checkoutMessage ? <p className="form-status">{checkoutMessage}</p> : null}
            </div>
          </div>
        </aside>
      ) : null}

      {authOpen ? (
        <aside className="drawer">
          <button className="drawer-backdrop" onClick={() => setAuthOpen(false)} aria-label="Close login" />
          <div className="drawer-panel">
            <div className="drawer-head">
              <h2>Login</h2>
              <button className="icon-button" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            </div>
            <div className="login-card">
              <LockKeyhole size={28} />
              <h3>{user ? "Account verified" : "Mobile OTP login"}</h3>
              <p>
                {user
                  ? `Logged in with ${user.mobile}. Orders can now be placed with a delivery address.`
                  : "Enter your mobile number to receive a one-time password by SMS."}
              </p>
              {user ? (
                <div className="account-actions">
                  <button className="primary-button justify-center" onClick={openOrders}>
                    My orders <Boxes size={18} />
                  </button>
                  <button className="secondary-button justify-center" onClick={logout}>Logout</button>
                </div>
              ) : otpStage === "mobile" ? (
                <>
                  <input
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10 digit mobile number"
                    inputMode="numeric"
                  />
                  <button className="primary-button justify-center" onClick={requestOtp} disabled={authBusy || mobile.length !== 10}>
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
                  <button className="primary-button justify-center" onClick={verifyOtp} disabled={authBusy || otp.length < 4}>
                    {authBusy ? "Verifying..." : "Verify OTP"}
                  </button>
                  <button
                    className="secondary-button justify-center"
                    onClick={() => {
                      setOtpStage("mobile");
                      setOtp("");
                      setAuthMessage("");
                    }}
                  >
                    Change number
                  </button>
                </>
              )}
              {authMessage ? <p className="form-status">{authMessage}</p> : null}
            </div>
          </div>
        </aside>
      ) : null}

      {ordersOpen ? (
        <aside className="drawer">
          <button className="drawer-backdrop" onClick={() => setOrdersOpen(false)} aria-label="Close orders" />
          <div className="drawer-panel orders-panel">
            <div className="drawer-head">
              <div>
                <h2>Your orders</h2>
                <p className="drawer-subtitle">All purchases, payment results and delivery updates for {user?.mobile}</p>
              </div>
              <button className="icon-button" onClick={() => setOrdersOpen(false)}><X size={18} /></button>
            </div>
            <button className="secondary-button justify-center" onClick={loadCustomerOrders} disabled={ordersLoading}>
              {ordersLoading ? "Refreshing..." : "Refresh orders"}
            </button>
            {ordersMessage ? <p className="form-status">{ordersMessage}</p> : null}
            <div className="orders-list">
              {ordersLoading && !orders.length ? (
                <div className="empty-cart">
                  <Clock3 size={28} />
                  <strong>Loading your orders</strong>
                  <span>Checking your NoteKart order history.</span>
                </div>
              ) : orders.length ? (
                orders.map((order) => (
                  <article className={`customer-order-card ${orderTone(order.paymentStatus)}`} key={order.id}>
                    <div className="customer-order-head">
                      <div>
                        <strong>Order #{order.id.slice(0, 8)}</strong>
                        <span>{formatOrderDate(order.createdAt)}</span>
                      </div>
                      <div className="customer-order-amount">
                        <strong>₹{order.amount}</strong>
                        <span>{orderPaymentLabel(order.paymentStatus)}</span>
                      </div>
                    </div>
                    <div className="customer-order-items">
                      {order.items.map((item) => (
                        <div className="customer-order-product" key={`${order.id}-${item.productId}-${item.customArtworkUrl ?? "catalog"}`}>
                          {item.imageUrl || item.customArtworkUrl || products.find((product) => product.id === item.productId)?.images[0] ? (
                            <img src={item.customArtworkUrl ?? item.imageUrl ?? products.find((product) => product.id === item.productId)?.images[0] ?? ""} alt={item.name} />
                          ) : <span className="order-product-placeholder"><NotebookPen size={18} /></span>}
                          <span>
                            <strong>{item.quantity} × {item.name}</strong>
                            {item.customCoverName ? <small>Cover name: {item.customCoverName}</small> : null}
                            {item.customArtworkUrl ? <small>Custom cover artwork attached</small> : null}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="customer-order-meta">
                      <span>{deliveryLabel(order)}</span>
                      <span>{providerLabel(order.deliveryProvider)}</span>
                      {order.deliveryTrackingNumber ? <span>Tracking: {order.deliveryTrackingNumber}</span> : null}
                    </div>
                    {order.deliveryProvider === "delhivery" && order.deliveryTrackingNumber ? (
                      <div className="delivery-tracking-box">
                        <button
                          className="secondary-button justify-center"
                          type="button"
                          onClick={() => loadOrderTracking(order.id)}
                          disabled={trackingByOrder[order.id]?.loading}
                        >
                          {trackingByOrder[order.id]?.loading ? "Checking..." : "Track delivery"} <Truck size={17} />
                        </button>
                        {trackingByOrder[order.id]?.message ? <span>{trackingByOrder[order.id]?.message}</span> : null}
                        {trackingByOrder[order.id]?.scans?.length ? (
                          <ol>
                            {trackingByOrder[order.id]?.scans?.map((scan) => <li key={scan}>{scan}</li>)}
                          </ol>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="order-timeline">
                      {buildOrderTimeline(order).map(({ title, body, tone, icon: Icon }) => (
                        <div className={`order-timeline-step ${tone}`} key={title}>
                          <div className="order-timeline-icon">
                            <Icon size={16} />
                          </div>
                          <div>
                            <strong>{title}</strong>
                            <span>{body}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-cart">
                  <ShoppingBag size={28} />
                  <strong>No orders yet</strong>
                  <span>Your successful, pending, failed, or cancelled orders will appear here after checkout starts.</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      {mobileNavOpen ? (
        <aside className="drawer">
          <button className="drawer-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" />
          <div className="drawer-panel max-w-xs">
            <div className="drawer-head">
              <h2>Menu</h2>
              <button className="icon-button" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
            </div>
            <a className="mobile-link" href="#products">Products</a>
            <a className="mobile-link" href="#custom">Customize</a>
            <a className="mobile-link" href="#reviews">Reviews</a>
            <a className="mobile-link" href="#about">About us</a>
            <button className="mobile-link text-left" onClick={openOrders}>
              My orders
            </button>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
