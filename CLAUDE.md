# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Policy

This project uses **English** as the primary language. Use English for:

- Code, comments, and variable/function names
- Commit messages and PR titles/descriptions
- GitHub Actions workflow names and job names
- User-facing UI text
- All documentation except the files listed below

**Exception**: `README.ja.md` and any other `.ja.md` files are intentionally written in Japanese and should remain so.

**Exception**: Bilingual UI components (English primary, Japanese subtitle) are permitted where the target audience is Japanese speakers. In such cases, English must be the primary/larger text and Japanese may appear as smaller supplementary text.

## Pull Request Management

When new changes are pushed to a PR branch, update the PR title and description to reflect the current state of all changes on the branch.

## Pull Request Review Comments

When subscribed to PR activity, always reply to every review comment — including bot comments (e.g., Gemini, CodeRabbit). Acknowledge the finding and briefly explain the decision taken (accepted, rejected with reason, or no action needed).

## Documentation

- `README.md` — English user-facing documentation
- `README.ja.md` — Japanese version of the same documentation
- `package.json` is the source of truth for dependency versions and npm scripts.

## Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server (requires build first)
npm run typecheck    # Type-check only (tsc --noEmit)
npm run lint         # Next.js ESLint
npm test             # Run all tests once (vitest run)
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run E2E tests against a local Next dev server on port 3099
```

To run a single test file:
```bash
npx vitest run tests/relay/slack.test.ts
```

To run only the E2E suite:
```bash
npx vitest run --config vitest.config.e2e.ts
```

## Environment Variables

Copy `.env.example` to `.env.local` and set at least one of:
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook URL
- `TEAMS_WEBHOOK_URL` — Microsoft Teams Incoming Webhook URL

If both are unset, every relay is skipped and the API responds `ok: false`.

## Architecture

**waigaya-relay** is a Next.js (App Router) app that accepts a chat message from a web UI and relays it to Slack and/or Microsoft Teams via Incoming Webhooks, creating a thread-starting post on each platform. Dependency versions are managed in `package.json` (currently Next.js 16 / React 19).

### Request flow

```
Browser (app/page.tsx)
  → POST /api/messages   (app/api/messages/route.ts)
      → postToSlack()    (lib/relay/slack.ts)   ─┐ Promise.all (independent)
      → postToTeams()    (lib/relay/teams.ts)   ─┘
  ← { ok, results[] }
```

- **`lib/types.ts`** — shared types (`RelayTarget`, `PostMessageRequest`, `RelayResponse`, `RelayResult`)
- **`lib/config.ts`** — reads `SLACK_WEBHOOK_URL` / `TEAMS_WEBHOOK_URL` from `process.env`; never logs the values
- **`lib/relay/slack.ts`** — posts `{ text }` JSON to Slack webhook
- **`lib/relay/teams.ts`** — posts `MessageCard` format JSON to Teams webhook
- **`app/api/messages/route.ts`** — validates input, fans out to both relays, assembles response
- **`app/page.tsx`** — client component with textarea, calls the API, renders per-target status

### Key design decisions

- **Both relays always run in parallel** (`Promise.all`). A failure in one does not block the other.
- **Relay responses return HTTP 200** even when a configured relay fails. This prevents Vercel's CDN from replacing the JSON body with an HTML error page, which would break the frontend's `res.json()` call.
- **Validation errors return HTTP 400** with JSON (`ok: false`, `error`) for malformed JSON, empty messages, or messages over 4000 characters.
- **`ok` logic**: `true` only when at least one relay executed (not skipped) AND all executed relays succeeded. All-skipped → `ok: false`.
- **Webhook timeout**: 5000 ms (`AbortSignal.timeout`) on every outbound fetch.
- **Teams payload**: uses the legacy `MessageCard` format (`@type`, `@context`, `summary`, `text`).
- **Webhook URLs never reach the browser**: the frontend calls `/api/messages` only; the route handler reads the URLs from `process.env` server-side.

### Tests

Tests live under `tests/` mirroring `lib/` and `app/` structure. Vitest is configured with the `@/` path alias (same as Next.js).

- Unit/API tests use `vitest.config.ts`; this excludes `tests/e2e/**`.
- Relay tests (`tests/relay/`) mock `fetch` directly.
- API route tests (`tests/api/`) mock `@/lib/relay/slack` and `@/lib/relay/teams` at the module level.
- E2E tests use `vitest.config.e2e.ts`; `tests/e2e/setup.ts` starts a mock webhook server on port 19999 and a Next dev server on port 3099.
