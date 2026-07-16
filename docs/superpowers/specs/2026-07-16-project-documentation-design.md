# Project Documentation Design

## Goal

Create a durable Russian-language source of truth for the Dominoes project. The documentation must describe both the implemented Web MVP and the agreed product roadmap without presenting planned capabilities as already available.

## Documentation set

### `docs/PROJECT.md`

This is the entry point for product and engineering decisions. It will contain:

- the product purpose and supported play modes;
- a status legend: **Implemented**, **Next stage**, and **Future**;
- the current Web MVP scope and the Telegram, Android, and iOS roadmap;
- the selected programming languages, frameworks, infrastructure, and deployment targets;
- the monorepo architecture and responsibilities of each application and shared package;
- identity, unique username, authenticated player, guest, invite, and account-linking decisions;
- server-authoritative API, realtime, persistence, security, localization, accessibility, observability, and operations decisions;
- development conventions for code, tests, Git, API compatibility, error handling, and documentation;
- an updated development roadmap;
- links to detailed game rules, runbooks, and historical specifications.

### `docs/GAME_RULES.md`

This is the normative human-readable description of the Draw Dominoes rules used by the application. It will contain:

- the double-six set, seats, deal, boneyard, and match target;
- opening-player selection and the first move;
- legal placement on the left and right ends;
- draw-until-playable behavior and passing;
- normal and blocked round completion;
- scoring, ties, the next starter, and match completion;
- deterministic medium-AI behavior;
- invalid actions and important edge cases;
- an explicit separation between implemented MVP rules and possible future variants.

The current game-engine implementation and its automated tests determine technical behavior. If the prose and executable behavior disagree, the discrepancy must be resolved deliberately by changing either the code or the documented product decision; it must not remain implicit.

### README navigation

`README.md` and `README-ru.md` will receive a short Documentation section linking to `docs/PROJECT.md`, `docs/GAME_RULES.md`, and operational runbooks. Existing historical plans and specifications remain in place for traceability.

## Status model

Every capability whose availability could be misunderstood will use one of these labels:

- **Implemented** — present in the repository and intended to work in the current Web MVP.
- **Next stage** — agreed work that directly follows stabilization and deployment of the Web MVP.
- **Future** — directional scope that has been accepted but is not yet committed to a release.

The documents will avoid percentages and dates that are not backed by an approved delivery commitment.

## Content authority

The documentation hierarchy is:

1. Current product decisions in `docs/PROJECT.md` and `docs/GAME_RULES.md`.
2. Executable contracts, migrations, game-engine code, and automated tests for exact technical behavior.
3. Runbooks for operational procedures.
4. Dated files under `docs/superpowers/specs` and `docs/superpowers/plans` as historical design and implementation records.

When behavior changes, the corresponding source document and tests must change in the same pull request or commit.

## Accuracy constraints

- Describe only behavior supported by the current repository as **Implemented**.
- Mark Telegram, Android, and iOS clients as planned rather than available.
- Preserve the selected architecture: TypeScript monorepo, Next.js PWA, NestJS API, shared game engine and contracts, Prisma/PostgreSQL, Supabase Auth, and Socket.IO.
- Preserve current rules: double-six, seven tiles per player, 1v1 Web MVP, draw until a playable tile is found, matches to 100 points, opponent-pip scoring on domino, and hand-difference scoring for a uniquely lowest blocked hand.
- State that a blocked tie awards zero points and rotates the next starter.
- Document that the current AI deterministically plays the legal tile with the highest pip total, draws when required, and otherwise passes.
- Do not expose secrets, production identifiers, or environment values in documentation examples.

## Verification

Before committing the final documentation:

1. Scan for unfinished placeholders and unresolved questions.
2. Compare rule statements with `packages/game-engine/src/index.ts` and its tests.
3. Compare stack statements with workspace and application `package.json` files.
4. Verify all relative Markdown links.
5. Run the repository documentation-sensitive checks and the complete `pnpm check` suite when dependencies are available.
6. Confirm that the working tree contains only the intended documentation changes before committing and pushing `master`.
