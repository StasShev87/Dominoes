# Dominoes Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready responsive Draw Dominoes PWA with accounts, AI matches, and private guest matches.

**Architecture:** A TypeScript modular monolith uses Next.js for web, NestJS for authoritative commands and Socket.IO, Supabase Auth/PostgreSQL for identity and persistence, and dependency-free shared packages for rules and contracts.

**Tech Stack:** Node 24 LTS, pnpm, Turborepo, TypeScript, Next.js, NestJS, Prisma, Supabase, Socket.IO, Zod, Vitest, fast-check, Playwright.

## Global Constraints

- Draw Dominoes double-six; MVP is 1v1 and matches run to 100 points.
- UI locales are `uk`, `en`, and `ru`; default is `uk`.
- All state changes are server-authoritative, versioned, and idempotent.
- Hidden hands and boneyard order never cross an unauthorized boundary.
- Production changes follow red-green-refactor and include automated tests.

---

### Task 1: Workspace and deterministic game engine

**Produces:** `@dominoes/game-engine` with `createMatch`, `getLegalActions`, `applyCommand`, replayable events, and seat-specific views.

- [ ] Establish workspace, quality scripts, documentation, and CI.
- [ ] Write failing rules tests and property tests.
- [ ] Implement the minimum pure engine required by each test.
- [ ] Verify unit tests, typecheck, lint, and build.

### Task 2: Shared API contracts

**Consumes:** game command and view types from Task 1.
**Produces:** `@dominoes/contracts` Zod schemas and stable error codes.

- [ ] Write failing validation and compatibility tests.
- [ ] Implement profile, match, invite, command, snapshot, event, and error schemas.
- [ ] Verify type inference and malformed-input rejection.

### Task 3: Authoritative NestJS API

**Consumes:** Tasks 1-2.
**Produces:** `/v1/health`, profile, match, invite, snapshot, command, and guest-claim endpoints plus Socket.IO events.

- [ ] Write controller/service tests for authorization, idempotency, stale versions, and hidden state.
- [ ] Add Prisma schema and migrations for accounts, identities, profiles, guests, matches, seats, snapshots, commands, events, invites, and results.
- [ ] Implement Supabase JWT and guest principal guards.
- [ ] Implement transactional command handling and seat-specific serialization.
- [ ] Add realtime subscriptions, rate limiting, structured errors, and correlation IDs.

### Task 4: Responsive Next.js PWA

**Consumes:** contracts and API client.
**Produces:** localized auth, home, lobby, game, result, profile, and settings flows.

- [ ] Write component tests for board interaction and localized states.
- [ ] Implement the responsive game table with tap/click side selection and keyboard access.
- [ ] Implement auth, AI creation, private invitation, guest join, reconnect, and claim flows.
- [ ] Add PWA metadata, offline shell, WCAG 2.2 AA behavior, and three locales.

### Task 5: Production readiness

- [ ] Add two-context Playwright flows for AI, private match, refresh, offline, reconnect, and expired invites.
- [ ] Add GitHub Actions, Render/Vercel configuration, Supabase production checklist, Sentry, and privacy-safe analytics.
- [ ] Run unit, integration, E2E, load, security, and backup-restore checks.
- [ ] Document deployment, incident response, and account deletion runbooks.

