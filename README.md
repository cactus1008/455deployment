# Shop DB Web Starter

Starter Next.js app that reads from `shop.db` using SQLite.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Included routes

- `GET /api/stats`
- `GET /api/products?limit=10`
- `GET /api/orders?limit=10`

## Notes for Vercel deployment

- This starter is good for local development and initial deployment setup.
- SQLite files inside serverless deployments are read-only at runtime.
- If you need writes or larger production scale, move data to a hosted DB later.
