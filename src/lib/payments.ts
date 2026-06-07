import type { PaymentGateway } from "./types";

export const paymentGateways = ["cashfree", "phonepe", "razorpay"] as const satisfies readonly PaymentGateway[];

export function normalizePaymentGateway(value: unknown): PaymentGateway {
  return paymentGateways.includes(value as PaymentGateway) ? (value as PaymentGateway) : "cashfree";
}

export function paymentGatewayLabel(gateway?: PaymentGateway | null) {
  if (gateway === "phonepe") return "PhonePe";
  if (gateway === "razorpay") return "Razorpay";
  return "Cashfree";
}

export function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}
