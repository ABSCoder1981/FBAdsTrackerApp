# FB Ads Tracker

Internal agency dashboard for tracking Facebook Ads campaign performance across multiple clients. See [`PRD.md`](./PRD.md) for full product spec.

## Stack

- Next.js (App Router, TypeScript) + Tailwind
- Supabase (Postgres) for data
- Netlify for hosting + scheduled sync function

## Local development

```bash
npm install
npm run dev
```

Requires a `.env.local` with Supabase and Facebook Marketing API credentials (not committed — see your team's secret store).

## Database migrations

SQL migrations live in `supabase/migrations/`. Apply them via the Supabase SQL editor or `supabase db push` — review each one before running against production data.
