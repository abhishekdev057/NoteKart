import { PhonePeStatus } from "@/components/PhonePeStatus";

export default async function PhonePeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantOrderId?: string }>;
}) {
  const params = await searchParams;

  return <PhonePeStatus merchantOrderId={params.merchantOrderId} />;
}
