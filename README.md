# NoteKart

Next.js storefront and admin console for NoteKart, a notebook and customized notebook business in Doomra, Ward no. 11, Nawalgarh, Jhunjhunu.

## Features

- Mobile-first notebook storefront
- Guest cart with refresh-safe persistence
- Product image preview, zoom, and quantity controls
- Customized notebook request flow with artwork upload
- Mobile OTP login demo
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

Create `.env.local` with:

```bash
DATABASE_URL=
DATABASE_URL_UNPOOLED=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ADMIN_MOBILES=
PHONEPE_ENV=
PHONEPE_CLIENT_ID=
PHONEPE_CLIENT_SECRET=
PHONEPE_CLIENT_VERSION=
NEXT_PUBLIC_SITE_URL=
DELHIVERY_ENV=
DELHIVERY_API_TOKEN=
```

OTP accepts four repeated digits for now, such as `0000`, `1111`, or `2222`.

## Checks

```bash
npm run lint
npm run build
```
