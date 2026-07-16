# Project Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an authoritative Russian-language project guide and game-rules guide, expose both from the README files, verify them, commit the changes, and push `master`.

**Architecture:** `docs/PROJECT.md` owns current product and engineering decisions; `docs/GAME_RULES.md` owns normative human-readable game behavior. Executable contracts, migrations, engine code, and tests remain the source for exact technical behavior, while dated specs and plans remain historical records.

**Tech Stack:** Markdown, TypeScript monorepo, Node.js 24, pnpm 11, Turborepo, Next.js, NestJS, Prisma/PostgreSQL, Supabase Auth, Socket.IO, Zod, Vitest, Playwright.

## Global Constraints

- Use Russian for both new source documents.
- Mark capabilities as **Реализовано**, **Следующий этап**, or **Будущее**.
- Do not describe Telegram, Android, or iOS clients as currently available.
- Keep rules consistent with `packages/game-engine/src/index.ts` and `packages/game-engine/src/index.test.ts`.
- Keep stack statements consistent with workspace and application `package.json` files.
- Preserve existing dated specifications, plans, and runbooks.
- Do not include credentials, environment values, or unapproved delivery dates.

---

### Task 1: Authoritative project guide

**Files:**
- Create: `docs/PROJECT.md`
- Reference: `docs/superpowers/specs/2026-07-16-project-documentation-design.md`
- Reference: `package.json`
- Reference: `apps/web/package.json`
- Reference: `apps/api/package.json`
- Reference: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Consumes: the approved documentation design and current repository structure.
- Produces: the canonical navigation and decision record for product and engineering work.

- [ ] **Step 1: Create the document skeleton**

Create these sections in order: purpose, status legend, product scope, current Web MVP, roadmap, stack, repository architecture, accounts and access, game and realtime flow, data and security, localization and accessibility, infrastructure, engineering conventions, quality gates, roadmap, and source-of-truth links.

- [ ] **Step 2: Record current and planned capabilities**

Label browser desktop/mobile, accounts, AI, and private-link matches as **Реализовано**. Label production hardening and Web MVP stabilization as **Следующий этап**. Label Telegram bot plus Mini App and Expo/React Native Android/iOS clients as **Будущее**.

- [ ] **Step 3: Record engineering conventions**

Specify server authority, versioned `/v1` contracts, Zod validation, idempotent commands, stable error codes, hidden-information boundaries, migrations, test-first changes, Conventional Commit-style messages, focused commits, protected secrets, synchronized documentation, and required checks.

- [ ] **Step 4: Verify content against repository metadata**

Run:

```powershell
rg -n 'Node|pnpm|Next.js|NestJS|Prisma|Supabase|Socket.IO|Zod|Vitest|Playwright|Реализовано|Следующий этап|Будущее' docs/PROJECT.md
```

Expected: every required stack component and all three status labels appear.

### Task 2: Normative game rules

**Files:**
- Create: `docs/GAME_RULES.md`
- Reference: `packages/game-engine/src/index.ts`
- Reference: `packages/game-engine/src/index.test.ts`

**Interfaces:**
- Consumes: `createMatch`, `getLegalActions`, `applyCommand`, `chooseAiCommand`, scoring behavior, and round transition behavior.
- Produces: the human-readable rule contract linked from product documentation and README files.

- [ ] **Step 1: Document setup and legal play**

State: 28 unique double-six tiles; current Web MVP is 1v1; seven tiles per player; remaining fourteen tiles form the boneyard; default target is 100; the highest double starts, otherwise the highest-ranked tile holder starts; the first tile is placed to the left by the engine; later tiles must match one open end.

- [ ] **Step 2: Document drawing, passing, and invalid actions**

State: a player with a legal move must play; otherwise they draw one tile at a time without ending the turn until a move becomes available or the boneyard empties; passing is permitted only with no legal move and an empty boneyard; wrong-seat, unowned-tile, mismatched-side, premature draw, and premature pass commands are rejected.

- [ ] **Step 3: Document scoring and transitions**

State: domino scores all opponent pips; a blocked round ends after both players pass consecutively; the uniquely lowest hand wins the difference between hand totals; equal lowest totals award zero; a round winner starts the next round, while a tied blocked round rotates the starter; reaching at least 100 ends the match.

- [ ] **Step 4: Document AI and future variants**

State: current AI deterministically chooses the playable tile with the highest pip total, uses the first legal side, draws when required, and otherwise passes. Mark alternative sets, player counts, scoring modes, AI levels, tournaments, and ratings as outside current rules.

- [ ] **Step 5: Verify rule phrases against engine behavior**

Run:

```powershell
rg -n '28|семь|14|100|дубл|добира|пас|блок|разниц|нич|AI|стар' docs/GAME_RULES.md
pnpm --filter @dominoes/game-engine test
```

Expected: all rule topics are present and the engine test suite exits with code 0.

### Task 3: Documentation navigation and release

**Files:**
- Modify: `README.md`
- Modify: `README-ru.md`
- Verify: `docs/PROJECT.md`
- Verify: `docs/GAME_RULES.md`

**Interfaces:**
- Consumes: the two new source documents.
- Produces: discoverable documentation and a published `master` branch.

- [ ] **Step 1: Add README navigation**

Add a `Documentation` section to `README.md` and a `Документация` section to `README-ru.md`. Link to `docs/PROJECT.md`, `docs/GAME_RULES.md`, and `docs/runbooks` using relative Markdown links.

- [ ] **Step 2: Scan documentation quality**

Run:

```powershell
$patterns = @('TO' + 'DO', 'TB' + 'D', 'FIX' + 'ME', 'X' + 'XX')
Select-String -Path docs/PROJECT.md,docs/GAME_RULES.md,README.md,README-ru.md -Pattern $patterns
git diff --check
```

Expected: the placeholder search returns no matches and `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Verify all changed Markdown links**

Resolve every relative link in the four changed Markdown files from its containing directory and confirm each local target exists.

- [ ] **Step 4: Run the complete project checks**

Run:

```powershell
pnpm check
```

Expected: lint, typecheck, unit tests, and production builds all exit with code 0.

- [ ] **Step 5: Review and commit intended changes**

Run:

```powershell
git status --short
git diff --stat
git add docs/PROJECT.md docs/GAME_RULES.md README.md README-ru.md docs/superpowers/plans/2026-07-16-project-documentation.md
git commit -m "docs: add project guide and game rules"
```

Expected: the commit contains only the plan, two source documents, and README navigation changes.

- [ ] **Step 6: Push and verify GitHub synchronization**

Run:

```powershell
git push origin master
git status --short --branch
git ls-remote --heads origin master
```

Expected: local `master` tracks `origin/master`, the working tree is clean, and the remote hash equals local `HEAD`.
