import { PolicyPage } from "@/components/policy/PolicyPage";

export default function TermsAndConditionsPage() {
  return (
    <PolicyPage title="Terms and Conditions" updated="May 26, 2026">
      <p>
        These terms govern purchases, custom notebook requests, and use of the NoteKart website. NoteKart is based at
        Ward no. 11, Doomra, Nawalgarh, Jhunjhunu, Rajasthan.
      </p>
      <h2>Products and custom orders</h2>
      <p>
        Product images, sizes, paper details, page counts, prices, and availability may change based on material stock
        and production requirements. Custom notebook requests are confirmed only after NoteKart reviews the uploaded
        artwork and contacts the customer.
      </p>
      <h2>Payments</h2>
      <p>
        Online payments are processed through NoteKart&apos;s active payment gateway, currently Cashfree unless the admin
        changes it. Customers must complete payment on the secure checkout page. NoteKart does not store card, UPI PIN,
        or wallet credentials.
      </p>
      <h2>Order acceptance</h2>
      <p>
        NoteKart may contact the customer to confirm artwork quality, order quantity, notebook specifications, delivery
        location, and production timeline before accepting a custom order.
      </p>
      <h2>Contact</h2>
      <p>For support, contact NoteKart at Ward no. 11, Doomra, Nawalgarh, Jhunjhunu, Rajasthan.</p>
    </PolicyPage>
  );
}
