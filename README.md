# Dominoes

Draw Dominoes web MVP: a responsive Next.js client, an authoritative NestJS API, PostgreSQL/Prisma, Supabase Auth, and Socket.IO. It includes Ukrainian, English, and Russian interfaces, AI play, and private games via one-time links.

## Documentation

- [Project guide, architecture, stack, conventions, and roadmap](docs/PROJECT.md)
- [Current game rules](docs/GAME_RULES.md)
- [Operational runbooks](docs/runbooks)

## Local development

Node.js 24, pnpm 11, and Docker are required.

1. Copy `.env.example` to `.env` and fill in the Supabase configuration.
2. Start PostgreSQL and the API: `docker compose up --build`.
3. In another terminal, run `pnpm install --frozen-lockfile`, followed by `pnpm --filter @dominoes/web dev`.
4. Open `http://localhost:3000/uk`.

Without Supabase, the local web app uses a development principal; this mechanism is disabled in production.

## Verification and deployment

- `pnpm check` — types, tests, and the production build.
- `pnpm --filter @dominoes/api db:validate` — Prisma schema.
- `pnpm --filter @dominoes/api db:deploy` — migrations.
- `k6 run tests/load/ai-match.js` — load test scenario (run it against a dedicated environment).

The API and PostgreSQL are defined in `render.yaml`, and the web app is defined in `vercel.json`. Production requires `DATABASE_URL`, `SUPABASE_URL`, `GUEST_SESSION_SECRET`, `WEB_ORIGINS`, and the corresponding `NEXT_PUBLIC_*` variables. Operational procedures are available in [docs/runbooks](docs/runbooks).
