"use client";

import { PaymentStatus } from "./PaymentStatus";

export function PhonePeStatus({ merchantOrderId }: { merchantOrderId?: string }) {
  return <PaymentStatus gateway="phonepe" paymentReference={merchantOrderId} />;
}
