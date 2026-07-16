# AI Match Seed and E2E Design

## Problem

The web lobby sends `Date.now()` as the match seed. Current epoch millisecond values exceed PostgreSQL `INT4`, while Prisma persists `Match.seed` as an `INTEGER`. Creating an AI or private match therefore fails with an integer-conversion error before the game is stored.

The existing browser tests cover AI-match creation and refresh restoration, but they do not exercise game commands, legal pass behavior, automatic AI turns, or browser/API error collection.

## Seed handling

Normalize every externally supplied seed inside `MatchService`, before calling `createMatch`. The normalized value must be a deterministic integer in the inclusive range `0..2_147_483_646`, which is safe for PostgreSQL `INT4` and remains sufficient for the engine's seeded shuffle.

Both `createAiMatch` and `createPrivateMatch` use the same normalization boundary so no HTTP client can bypass it. The normalized value is stored in `MatchState.seed` and persisted unchanged by `PrismaMatchRepository`; the in-memory and PostgreSQL repositories therefore observe identical state.

Non-finite inputs are outside the HTTP contract and must resolve to a deterministic safe value rather than reach persistence. Negative and oversized finite inputs are folded into the supported range with positive modulo arithmetic.

## Regression tests

Add focused `MatchService` unit tests that first reproduce the oversized epoch-millisecond seed and then assert that:

- the stored AI match uses an `INT4`-safe seed;
- the same oversized input always produces the same normalized seed;
- private-match creation uses the same normalization rule.

Keep the repository schema unchanged. No database migration or `BigInt` conversion is needed.

## Playwright E2E coverage

Extend `tests/e2e/game-flows.spec.ts` with shared helpers for browser-error collection, fixed-seed request interception, deterministic action selection, and command-response observation.

The E2E suite covers three browser-level behaviors:

1. Open the localized home page and assert the primary actions render without page errors, failed requests, or HTTP 5xx responses.
2. Intercept AI-match creation to replace the request seed with a fixed known seed, start the match through the visible lobby button, assert the game board renders, and verify that refresh restores the same match.
3. Starting from a fixed seed, use a small deterministic PRNG to choose only controls currently exposed as legal actions. Play tiles through their visible tile/side controls, draw when the UI offers draw, and continue until the UI exposes pass. Observe each command response and assert that human commands succeed, the server returns to the human turn after automatic AI settlement, at least one response contains an AI action, and the pass response contains `PLAYER_PASSED` for the human followed by AI activity. Bound the loop and fail with diagnostic state if the chosen seed does not reach pass.

The test seed is selected once by simulating the engine and is then hard-coded, so the browser test remains reproducible. The action PRNG is also fixed; it is pseudo-random only within the currently legal visible actions.

## Error handling and diagnostics

Each Playwright test records `pageerror`, console errors, unexpected failed network requests, and HTTP responses with status `>= 500`. Next.js client navigation may cancel an obsolete `_rsc` GET with `net::ERR_ABORTED`; that specific cancellation is ignored because it has no server response and is expected router behavior. Assertions include collected diagnostics on failure.

The E2E flow uses visible roles and labels for user interactions. Network response bodies are inspected only to verify authoritative command events and AI settlement that the UI cannot expose directly. Tests must not add production-only selectors or test-only application behavior unless the existing accessible surface proves insufficient.

## Real Chrome verification

After automated checks pass, reload the running project in the user's real Chrome profile, start an AI match with the normal lobby flow, perform several legal visible actions, and confirm that:

- navigation reaches the game URL;
- the board remains interactive after AI responses;
- no `Internal server error`, page error, console error, or HTTP 5xx response appears.

The real-Chrome check complements Playwright but does not replace the deterministic automated pass scenario.

## Non-goals

- Changing the database seed column to `BIGINT`.
- Changing domino rules to make pass available when it is illegal.
- Exposing arbitrary seed controls in the production UI.
- Completing an entire match in every E2E run.
