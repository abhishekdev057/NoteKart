# NoteKart

Next.js storefront and admin console for NoteKart, a notebook and customized notebook business in Doomra, Ward no. 11, Nawalgarh, Jhunjhunu.

## Features

- Mobile-first notebook storefront
- Guest cart with refresh-safe persistence
- Product image preview, zoom, and quantity controls
- Customized notebook request flow with artwork upload
- Mobile OTP login demo
- Admin access for configured mobile numbers
- Admin product, category, media, order, analytics, Razorpay, and Shiprocket surfaces
- Neon Postgres, Cloudinary, Razorpay, and Shiprocket-ready API routes

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
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
```

OTP accepts four repeated digits for now, such as `0000`, `1111`, or `2222`.

## Checks

```bash
npm run lint
npm run build
```
