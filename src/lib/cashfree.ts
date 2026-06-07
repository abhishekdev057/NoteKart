import type { Order } from "./types";
import { siteUrl } from "./payments";

const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";

export type CashfreeMode = "sandbox" | "production";

export function getCashfreeMode(): CashfreeMode {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

export function getCashfreeBaseUrl() {
  return getCashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function getCashfreeCredentials() {
  const appId = process.env.CASHFREE_APP_ID || process.env.CASHFREE_CLIENT_ID;
  const secret = process.env.CASHFREE_SECRET_KEY || process.env.CASHFREE_CLIENT_SECRET;
  return appId && secret ? { appId, secret } : null;
}

function cashfreeHeaders() {
  const credentials = getCashfreeCredentials();
  if (!credentials) return null;
  return {
    "Content-Type": "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": credentials.appId,
    "x-client-secret": credentials.secret,
  };
}

export function cashfreeConfigured() {
  return Boolean(getCashfreeCredentials());
}

export function normalizeCashfreeState(orderStatus: unknown) {
  const status = String(orderStatus ?? "").toUpperCase();
  if (status === "PAID") return "COMPLETED";
  if (["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"].includes(status)) return "FAILED";
  return "PENDING";
}

export function cashfreeMessageForState(state: string) {
  if (state === "COMPLETED") return "Payment received. Your NoteKart order is confirmed.";
  if (state === "FAILED") return "Cashfree did not confirm this payment. No paid order has been confirmed.";
  return "Payment is still pending. We are checking Cashfree again automatically.";
}

export async function createCashfreeOrder(order: Order, customerMobile: string) {
  const headers = cashfreeHeaders();
  const cashfreeOrderId = `nk_${order.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`;

  if (!headers) {
    return {
      mock: true,
      orderId: cashfreeOrderId,
      paymentSessionId: null,
      mode: getCashfreeMode(),
      message: "Cashfree credentials are not configured.",
    };
  }

  const response = await fetch(`${getCashfreeBaseUrl()}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      order_id: cashfreeOrderId,
      order_amount: order.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: `notekart_${customerMobile}`,
        customer_name: order.customerName,
        customer_phone: customerMobile,
      },
      order_meta: {
        return_url: `${siteUrl()}/payment/cashfree/redirect?order_id={order_id}`,
      },
      order_note: `NoteKart order ${order.id}`,
      order_tags: {
        notekart_order_id: order.id,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      error: typeof data?.message === "string" ? data.message : "Unable to create Cashfree payment.",
      status: response.status,
    };
  }

  return {
    orderId: String(data.order_id ?? cashfreeOrderId),
    cfOrderId: data.cf_order_id ? String(data.cf_order_id) : null,
    paymentSessionId: data.payment_session_id ? String(data.payment_session_id) : null,
    mode: getCashfreeMode(),
  };
}

export async function getCashfreeOrder(orderId: string) {
  const headers = cashfreeHeaders();
  if (!headers) return null;

  const response = await fetch(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
