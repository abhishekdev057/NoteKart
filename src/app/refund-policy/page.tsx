import { PolicyPage } from "@/components/policy/PolicyPage";

export default function RefundPolicyPage() {
  return (
    <PolicyPage title="Refund Policy" updated="May 26, 2026">
      <p>
        Refunds are handled case by case for failed payments, duplicate payments, unavailable products, or orders that
        NoteKart cannot produce after review.
      </p>
      <h2>Eligible refunds</h2>
      <p>
        A refund may be issued if payment is deducted but the order is not confirmed, if the same order is paid twice,
        or if NoteKart is unable to complete the order due to stock or production limitations.
      </p>
      <h2>Custom notebook refunds</h2>
      <p>
        Customized notebooks are made to customer requirements. Once artwork is approved and production begins, refunds
        may not be available unless there is a verified production issue from NoteKart&apos;s side.
      </p>
      <h2>Timeline</h2>
      <p>
        Approved refunds are initiated to the original payment method through PhonePe or the relevant banking channel.
        Bank processing timelines may vary.
      </p>
    </PolicyPage>
  );
}
