import { PolicyPage } from "@/components/policy/PolicyPage";

export default function ShippingPolicyPage() {
  return (
    <PolicyPage title="Shipping Policy" updated="May 26, 2026">
      <p>
        NoteKart ships confirmed notebook orders after production and packing from Doomra, Nawalgarh, Jhunjhunu,
        Rajasthan.
      </p>
      <h2>Delivery areas</h2>
      <p>
        Local delivery or courier dispatch availability is confirmed after order review. Delivery timelines depend on
        product type, customization work, quantity, customer location, and courier availability.
      </p>
      <h2>Custom order timelines</h2>
      <p>
        Custom notebooks require artwork review and production time before dispatch. NoteKart will contact customers to
        confirm expected timelines.
      </p>
      <h2>Tracking</h2>
      <p>
        When courier tracking is available, NoteKart may share tracking details with the customer after dispatch.
      </p>
    </PolicyPage>
  );
}
