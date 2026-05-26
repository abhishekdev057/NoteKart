import Link from "next/link";

export default async function PhonePeRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantOrderId?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="policy-page">
      <section className="policy-card">
        <p className="policy-kicker">PhonePe payment</p>
        <h1>Payment status is being confirmed</h1>
        <p>
          Your PhonePe transaction has returned to NoteKart. If payment was completed, our team will confirm the order
          before production and delivery.
        </p>
        {params.merchantOrderId ? <p className="policy-note">Reference: {params.merchantOrderId}</p> : null}
        <Link className="primary-button justify-center" href="/">
          Back to NoteKart
        </Link>
      </section>
    </main>
  );
}
