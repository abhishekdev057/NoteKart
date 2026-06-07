import { PaymentStatus } from "@/components/PaymentStatus";

export default async function CashfreeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reference = typeof params.order_id === "string" ? params.order_id : undefined;
  return <PaymentStatus gateway="cashfree" paymentReference={reference} />;
}
