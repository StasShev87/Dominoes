# Dominoes Web MVP Design

## Product

Build a responsive, installable web application for Draw Dominoes. The MVP supports Ukrainian, English, and Russian; verified email/password or phone/password accounts with a unique username; guest joins by private link; games against one medium AI or one human; and resumable matches up to 24 hours after inactivity.

The rules use a double-six set, seven tiles per player, draw-until-playable behavior, and matches to 100 points. A normal round scores the opponent's remaining pips. A blocked round scores the difference between hands; equal hands score zero.

## Architecture

Use a TypeScript pnpm/Turborepo monorepo. Next.js provides the PWA, NestJS provides authoritative REST commands and Socket.IO subscriptions, and Supabase provides Auth and PostgreSQL. The dependency-free game engine and Zod contracts are shared packages. State changes are transactional, versioned, and idempotent; clients receive seat-specific views that never reveal hidden tiles.

Deploy the web app to Vercel, the long-running API to Render, and production data/Auth to Supabase Pro. Add Redis only when the API scales beyond one replica.

## Identity and future clients

Keep Dominoes accounts separate from login identities so Supabase email/phone identities and a future Telegram identity can attach to the same account. Telegram will use a bot plus Mini App. Future Android and iOS clients use Expo/React Native and consume the same versioned API.

## Quality

Use test-first development. Vitest and fast-check cover the engine and contracts, integration tests cover API transactions and authorization, Playwright covers two-browser gameplay and mobile layouts, and k6 validates the initial realtime load target. Accessibility targets WCAG 2.2 AA.

