import { PolicyPage } from "@/components/policy/PolicyPage";

export default function ReturnPolicyPage() {
  return (
    <PolicyPage title="Return Policy" updated="May 26, 2026">
      <p>
        NoteKart currently does not support general returns for correctly delivered customized notebooks because they are
        produced according to customer-specific artwork and requirements.
      </p>
      <h2>Damaged or incorrect items</h2>
      <p>
        If a notebook is damaged in transit or the delivered item is different from the confirmed order, contact
        NoteKart with photos and order details for review.
      </p>
      <h2>Custom products</h2>
      <p>
        Customer-approved custom covers, names, logos, photos, and artwork cannot usually be returned unless there is a
        verified production error.
      </p>
    </PolicyPage>
  );
}
