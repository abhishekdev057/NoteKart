import { PolicyPage } from "@/components/policy/PolicyPage";

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="Privacy Policy" updated="May 26, 2026">
      <p>
        NoteKart collects only the information needed to process notebook orders, custom requests, delivery coordination,
        and customer support.
      </p>
      <h2>Information we collect</h2>
      <p>
        We may collect customer name, mobile number, delivery details, uploaded artwork, order items, payment reference,
        and custom notebook requirements.
      </p>
      <h2>How we use information</h2>
      <p>
        Information is used to confirm orders, prepare design proofs, manufacture notebooks, coordinate delivery, and
        respond to support requests.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are handled by the active payment gateway selected by NoteKart, currently Cashfree by default. NoteKart
        does not store sensitive payment credentials such as card numbers, CVV, UPI PIN, or wallet passwords.
      </p>
      <h2>Data sharing</h2>
      <p>
        Order and delivery information may be shared with payment, delivery, hosting, and media-storage providers only
        as required to run the service.
      </p>
    </PolicyPage>
  );
}
