# QuantDefy

QuantDefy is a private post-trade review workspace for traders. It combines a calendar-first journal, structured trade capture, chart-backed evidence, analytics, and optional AI-assisted insight refreshes in one app.

## What It Does

- Review daily and weekly P/L through a calendar-driven dashboard
- Log trades with thesis, execution notes, tags, and fills
- Attach setup and post-trade screenshots to journal entries
- Analyze recurring mistakes, setups, sizing, and outcomes
- Generate local insight summaries by default, with optional premium semantic refreshes
- Support private multi-user hosting with server-side auth, quotas, and admin controls

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zod
- Neon Postgres for production persistence
- Local JSON/file runtime for local demo mode
- S3-compatible object storage for hosted uploads
- OpenAI API for optional semantic insight refreshes

## Routes

Public:

- `/`
- `/login`
- `/register`
- `/auth/google`
- `/auth/google/callback`

App:

- `/app`
- `/trades`
- `/trades/new`
- `/trades/[tradeId]`
- `/analytics`
- `/insights`
- `/settings`
- `/admin`

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If `DATABASE_URL` is not set, QuantDefy falls back to the local seeded runtime in `data/runtime`.

## Environment Variables

Core:

- `DATABASE_URL`
- `UPLOAD_RUNTIME`
- `TRUST_PROXY_IP_HEADERS`
- `RUNTIME_DATA_DIR`

Uploads:

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT`
- `S3_FORCE_PATH_STYLE`
- `S3_KEY_PREFIX`

Auth / admin:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAILS`

AI:

- `OPENAI_API_KEY`
- `SEMANTIC_REFRESH_MAX_PER_WINDOW`
- `SEMANTIC_REFRESH_WINDOW_MS`
- `SEMANTIC_REFRESH_COOLDOWN_MS`

See [`.env.example`](/Users/jiaweichen/Downloads/Trade%20Logger/.env.example) for the current template.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm test
npm run test:e2e
```

## Verification

Recommended checks before pushing or deploying:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Deployment Notes

For Vercel or other hosted deployments:

- use Neon via `DATABASE_URL`
- use `UPLOAD_RUNTIME=s3`
- keep `OPENAI_API_KEY` server-side
- set `TRUST_PROXY_IP_HEADERS=true` only behind a trusted proxy

Google OAuth is optional. Admin access is controlled by your app through `ADMIN_EMAILS`, not by Google alone.

## Status

The app supports local demo mode for development and a production-ready hosted path with Neon, S3, Google OAuth, semantic insight quotas, and an admin-only usage surface.
