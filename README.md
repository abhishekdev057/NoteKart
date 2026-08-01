# NoteKart

Next.js storefront and admin console for NoteKart, a notebook and customized notebook business in Doomra, Ward no. 11, Nawalgarh, Jhunjhunu.

## Features

- Mobile-first notebook storefront
- Guest cart with refresh-safe persistence
- Product image preview, zoom, and quantity controls
- Customized notebook request flow with artwork upload
- Real mobile OTP login (SMS provider) with signed httpOnly session cookies
- Server-side admin authorization on every admin/data API
- Server-side order pricing and PhonePe payment-amount verification
- Admin access for configured mobile numbers
- Dedicated admin pages for products, custom requests, orders, delivery review, and reports
- Neon Postgres, Cloudinary, PhonePe, and Delhivery-ready API routes
- Public policy pages for payment gateway website verification

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill it in. See that file for the full,
documented list. Required to boot:

- `DATABASE_URL` — Neon Postgres connection string
- `SESSION_SECRET` — long random string (`openssl rand -base64 32`); signs the
  session cookie and salts stored OTP hashes
- `ADMIN_MOBILES` — comma-separated 10-digit admin numbers
- `NEXT_PUBLIC_SITE_URL` — used to build PhonePe redirect URLs

## Authentication & OTP

Login supports the MSG91 OTP Widget. Configure `NEXT_PUBLIC_MSG91_WIDGET_ID`,
`NEXT_PUBLIC_MSG91_WIDGET_TOKEN`, and server-side `MSG91_AUTH_KEY`. After the
widget verifies the OTP, NoteKart validates the returned access token on the
server and then issues its own signed httpOnly session cookie.

The older direct SMS fallback is still available with `MSG91_TEMPLATE_ID` /
`MSG91_SENDER_ID` or Twilio (`SMS_PROVIDER` selects the provider).

In **development**, if no SMS provider is configured, the OTP is printed to the
server console and returned to the client as `devCode` so the flow is testable.
This fallback is **disabled in production** — a provider is required there.

OTP codes are stored hashed with a 5-minute expiry, limited to 5 verification
attempts, and rate-limited per mobile and per IP. Sessions are stateless,
HMAC-signed, httpOnly cookies. Every admin/data API verifies the session
server-side (`requireUser` / `requireAdmin`) — the client UI is never trusted
for authorization.

## Delhivery production tracking

Add these server-side variables to every production environment in Vercel:

- `DELHIVERY_API_TOKEN` — the live token from Delhivery One → Settings → API Setup
- `DELHIVERY_ENV=production`
- `DELHIVERY_PICKUP_LOCATION` — the exact, case-sensitive registered warehouse name (needed when creating shipments)

Do not prefix the token with `NEXT_PUBLIC_`. Order cards call NoteKart's protected
server routes, so the Delhivery credential is never sent to the browser.

## Checks

```bash
npm run lint
npm run build
```
