# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

- `README.md` — English user-facing documentation
- `README.ja.md` — Japanese version of the same documentation

## Commands

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm start            # Start production server (requires build first)
npm run typecheck    # Type-check only (tsc --noEmit)
npm run lint         # Next.js ESLint
npm test             # Run all tests once (vitest run)
npm run test:watch   # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run tests/relay/slack.test.ts
```

## Environment Variables

Copy `.env.example` to `.env.local` and set at least one of:
- `SLACK_WEBHOOK_URL` — Slack Incoming Webhook URL
- `TEAMS_WEBHOOK_URL` — Microsoft Teams Incoming Webhook URL

If both are unset, every relay is skipped and the API responds `ok: false`.

## Architecture

**waigaya-relay** is a Next.js (App Router) app that accepts a chat message from a web UI and relays it to Slack and/or Microsoft Teams via Incoming Webhooks, creating a thread-starting post on each platform.

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
- **The API always returns HTTP 200** (even on relay failure). This prevents Vercel's CDN from replacing the JSON body with an HTML error page, which would break the frontend's `res.json()` call.
- **`ok` logic**: `true` only when at least one relay executed (not skipped) AND all executed relays succeeded. All-skipped → `ok: false`.
- **Webhook timeout**: 5000 ms (`AbortSignal.timeout`) on every outbound fetch.
- **Teams payload**: uses the legacy `MessageCard` format (`@type`, `@context`, `summary`, `text`).
- **Webhook URLs never reach the browser**: the frontend calls `/api/messages` only; the route handler reads the URLs from `process.env` server-side.

### Tests

Tests live under `tests/` mirroring `lib/` and `app/` structure. Vitest is configured with the `@/` path alias (same as Next.js). The relay tests (`tests/relay/`) mock `fetch` directly; the API route tests (`tests/api/`) mock `@/lib/relay/slack` and `@/lib/relay/teams` at the module level.
