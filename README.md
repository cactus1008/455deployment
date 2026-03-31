# Shop DB Web App (Supabase)

Next.js web app for customer dashboard, order entry, order history, and warehouse late-delivery queue.

## Environment variables

Create `.env.local`:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required tables

- `customers`
- `products`
- `orders`
- `order_items`
- `shipments`
- `late_delivery_scores`

## Vercel deployment

1. Import the repo into Vercel.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in project environment variables.
3. Deploy.
