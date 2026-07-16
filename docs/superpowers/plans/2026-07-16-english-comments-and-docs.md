# English Comments and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every Russian documentation page under a `-ru` filename, replace its original path with an English translation, and ensure code comments contain no Russian text.

**Architecture:** Treat documentation as paired English-default and Russian-suffixed Markdown files. Use a repository-wide Cyrillic scan to distinguish documentation prose and localization fixtures from actual source comments, then verify that Cyrillic remains only in intentional Russian/Ukrainian content and Russian documentation copies.

**Tech Stack:** Markdown, TypeScript/JavaScript, PowerShell, ripgrep, pnpm

## Global Constraints

- Preserve Russian documentation content exactly in the new `-ru.md` copies.
- Keep the original documentation paths as the canonical English versions.
- Translate only comments in code; do not translate localization strings or non-ASCII validation fixtures.
- Do not change runtime behavior.

---

### Task 1: Pair the root README

**Files:**
- Create: `README-ru.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Existing Russian `README.md` content.
- Produces: A preserved Russian README and an English README at the conventional path.

- [x] **Step 1: Copy the current Russian README to `README-ru.md`**

Use a rename patch so the Russian text is preserved without semantic changes.

- [x] **Step 2: Create the English `README.md`**

Translate every heading, instruction, and operational note while preserving commands, paths, links, variable names, and product terminology.

- [x] **Step 3: Compare structure**

Run: `rg -n "^(#|[0-9]+\\.|- )" README.md README-ru.md`

Expected: Both files have matching heading, numbered-list, and bullet-list structures.

### Task 2: Pair the Russian runbooks

**Files:**
- Create: `docs/runbooks/account-deletion-ru.md`
- Create: `docs/runbooks/backup-restore-ru.md`
- Create: `docs/runbooks/deployment-ru.md`
- Create: `docs/runbooks/incident-response-ru.md`
- Modify: `docs/runbooks/account-deletion.md`
- Modify: `docs/runbooks/backup-restore.md`
- Modify: `docs/runbooks/deployment.md`
- Modify: `docs/runbooks/incident-response.md`

**Interfaces:**
- Consumes: Existing Russian runbook bodies.
- Produces: Four Russian copies and four canonical English runbooks.

- [x] **Step 1: Preserve each Russian runbook under a `-ru.md` name**

Use rename patches and keep all commands, identifiers, and headings intact.

- [x] **Step 2: Create English translations at the original paths**

Translate all prose accurately while preserving commands, environment variables, endpoints, and product identifiers.

- [x] **Step 3: Compare document structures**

Run: `rg -n "^(#|[0-9]+\\.)" docs/runbooks/*.md`

Expected: Every English/Russian pair has the same headings and numbered-step count.

### Task 3: Verify comments and repository integrity

**Files:**
- Inspect: all tracked source and configuration files
- Test: repository checks

**Interfaces:**
- Consumes: Completed documentation pairs and existing source tree.
- Produces: Evidence that no Russian code comments remain and behavior is unchanged.

- [x] **Step 1: Scan all Cyrillic occurrences**

Run: `rg -n --hidden -g '!node_modules' -g '!dist' -g '!build' -g '!.git' '[А-Яа-яЁё]' .`

Expected: Matches are limited to `*-ru.md`, intentional UI localization strings, and localization/validation tests; no source-code comments match.

- [x] **Step 2: Review the diff**

Run: `git diff --check && git diff --stat && git diff -- README.md README-ru.md docs/runbooks`

Expected: No whitespace errors; only documentation additions/replacements appear.

- [x] **Step 3: Run project verification**

Run: `pnpm check`

Expected: Lint, typecheck, unit tests, and production builds pass.
