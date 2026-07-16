# Dominoes

Веб-MVP Draw Dominoes: адаптивный Next.js-клиент, авторитетный NestJS API, PostgreSQL/Prisma, Supabase Auth и Socket.IO. Есть украинский, английский и русский интерфейсы, AI и приватная игра по одноразовой ссылке.

## Документация

- [Проект, архитектура, стек, соглашения и дорожная карта](docs/PROJECT.md)
- [Актуальные правила игры](docs/GAME_RULES.md)
- [Эксплуатационные инструкции](docs/runbooks)

## Локальный запуск

Нужны Node.js 24, pnpm 11 и Docker.

1. Скопируйте `.env.example` в `.env` и заполните Supabase-параметры.
2. Запустите PostgreSQL и API: `docker compose up --build`.
3. В другом терминале: `pnpm install --frozen-lockfile`, затем `pnpm --filter @dominoes/web dev`.
4. Откройте `http://localhost:3000/uk`.

Без Supabase локальный web использует dev-principal; в production этот механизм отключён.

## Проверки и deployment

- `pnpm check` — типы, тесты и production build.
- `pnpm --filter @dominoes/api db:validate` — Prisma schema.
- `pnpm --filter @dominoes/api db:deploy` — миграции.
- `k6 run tests/load/ai-match.js` — нагрузочный сценарий (запускать против отдельного окружения).

API/PostgreSQL описаны в `render.yaml`, web — в `vercel.json`. В production обязательны `DATABASE_URL`, `SUPABASE_URL`, `GUEST_SESSION_SECRET`, `WEB_ORIGINS` и соответствующие `NEXT_PUBLIC_*` переменные. Операционные процедуры: [docs/runbooks](docs/runbooks).
