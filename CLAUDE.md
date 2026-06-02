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

When creating or updating a PR description, follow `.github/PULL_REQUEST_TEMPLATE.md` exactly — use only the sections defined there and do not add extra sections (e.g. do not add a "Changes" section).

## Pull Request Review Comments

When subscribed to PR activity, always reply to every review comment — including bot comments (e.g., Gemini, CodeRabbit). Acknowledge the finding and briefly explain the decision taken (accepted, rejected with reason, or no action needed).

When a reply reports that code was changed in response to the comment, reference the specific commit that made the change by its hash — not a vague phrase like "fixed in the latest commit". Prefer a linked short SHA (e.g. ``[`36b2cd0`](https://github.com/mongolyy/waigaya-relay/commit/36b2cd0)``) so the fix can be traced even after later commits, rebases, or once the PR is merged. This does not apply to replies that make no code change (e.g. rejected suggestions or "no action needed").

After addressing a review comment, the resolution behavior depends on who left the comment:

- **Bot reviewers** (e.g., Gemini, GitHub Copilot, Claude): automatically resolve the conversation after replying. Do NOT mention the bot to avoid infinite loops.
- **Human reviewers**: do NOT resolve the conversation. Instead, mention the reviewer (`@username`) in your reply so they are notified. The reviewer decides the next step:
  - If satisfied → reviewer resolves the conversation themselves.
  - If not satisfied → reviewer mentions `@claude` and asks a follow-up question.

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

Copy `.env.example` to `.env.local`. Configure at least one destination:
- `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` — Slack bot token (`xoxb-…`, needs `chat:write`) and target channel id
- `TEAMS_WEBHOOK_URL` — Microsoft Teams Incoming Webhook URL

Optional:
- `SLACK_API_BASE_URL` — override the Slack Web API base URL (used by E2E tests to target a mock server; defaults to `https://slack.com/api`)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — durable session→thread store; falls back to an in-memory Map when unset

If no destination is configured, every relay is skipped and the API responds `ok: false`.

## Architecture

**waigaya-relay** is a Next.js (App Router) app that accepts a chat message from a web UI and relays it to Slack (via the Web API `chat.postMessage`) and/or Microsoft Teams (via an Incoming Webhook). Each chat-log **session** posts into its own Slack thread: the first message starts a thread and its `ts` is stored per session, so subsequent messages reply into the same thread. Dependency versions are managed in `package.json` (currently Next.js 16 / React 19).

### Layer structure

The codebase is organized into four layers. Each layer may only depend on layers below it.

| Layer | Location | Responsibility |
|---|---|---|
| Presentation | `app/` | Next.js pages, client components, UI logic |
| API Handler | `app/api/**/route.ts` | HTTP request parsing and response mapping only — no business logic |
| Use Case | `lib/usecase/` | Input validation, business rules, orchestration of infrastructure calls |
| Infrastructure | `lib/relay/`, `lib/store.ts`, `lib/session-store.ts`, `lib/config.ts` | External services, persistence, environment configuration |

When adding new behaviour: put validation and orchestration in `lib/usecase/`, keep route handlers thin (JSON parse → usecase call → HTTP response), and put all outbound I/O in the infrastructure files.

### Request flow

```
Browser (app/page.tsx → MessageComposer.tsx, sends { message, sessionId })
  → POST /api/messages        (app/api/messages/route.ts)
      → relayMessage()        (lib/usecase/relayMessage.ts)
          → createMessage(messageId, message)      (lib/store.ts)
          → getSessionThread(sessionId)            (lib/session-store.ts)
          → postToSlack({token,channel}, msg, ts?) (lib/relay/slack.ts)  ─┐ Promise.all
          → postToTeams(webhookUrl, msg)           (lib/relay/teams.ts)  ─┘
          → saveSessionThread(sessionId, { slackThreadTs }) on first post
  ← { ok, results[], messageId }
```

- **`lib/types.ts`** — shared types (`RelayTarget`, `PostMessageRequest` incl. optional `sessionId`, `PostMessageResponse`, `RelayResult` incl. optional Slack `ts`)
- **`lib/config.ts`** — reads `SLACK_BOT_TOKEN` / `SLACK_CHANNEL_ID` / `SLACK_API_BASE_URL` / `TEAMS_WEBHOOK_URL` from `process.env`; never logs the values
- **`lib/relay/slack.ts`** — posts to Slack `chat.postMessage` with a bearer token; threads via `thread_ts`; returns the message `ts`
- **`lib/relay/teams.ts`** — posts `MessageCard` format JSON to the Teams webhook (no threading)
- **`lib/session-store.ts`** — maps `sessionId → { slackThreadTs }`; Upstash Redis (REST) when configured, else in-memory Map
- **`lib/usecase/relayMessage.ts`** — validates message/username/sessionId, orchestrates session lookup, parallel relay calls, thread anchor persistence, and assembles the response
- **`lib/usecase/reaction.ts`** — validates emoji and messageId, delegates to the store; shared `validateReaction` helper eliminates duplication between add and remove
- **`app/api/messages/route.ts`** — parses JSON body, calls `relayMessage`, maps result to HTTP response
- **`app/api/reactions/route.ts`** — parses JSON body / query params, calls reaction use cases, maps results to HTTP responses
- **`app/MessageComposer.tsx`** — client component; generates/persists `sessionId` in `sessionStorage`, sends it with each message, and offers a **Start new thread** button

### Key design decisions

- **Both relays always run in parallel** (`Promise.all`). A failure in one does not block the other.
- **Sessions define threads**: a `sessionId` (one per chat log) is generated client-side and persisted in `sessionStorage`. The server stores the Slack `ts` of the first post and replies into it with `thread_ts` thereafter. `sessionId` is optional server-side — when absent, the message is posted as a new top-level message.
- **Slack uses the Web API, not a webhook**: Incoming Webhooks cannot reply into a thread, so `chat.postMessage` (bot token) is required. Slack returns HTTP 200 even on errors; the JSON `ok` field is authoritative.
- **Teams has no threading** (Incoming Webhook limitation); a Graph API migration would be needed and is out of scope for now.
- **Relay responses return HTTP 200** even when a configured relay fails. This prevents Vercel's CDN from replacing the JSON body with an HTML error page, which would break the frontend's `res.json()` call.
- **Validation errors return HTTP 400** with JSON (`ok: false`, `error`) for malformed JSON, empty messages, or messages over 4000 characters.
- **`ok` logic**: `true` only when at least one relay executed (not skipped) AND all executed relays succeeded. All-skipped → `ok: false`.
- **Outbound timeout**: 5000 ms (`AbortSignal.timeout`) on every outbound fetch (Slack, Teams, Upstash).
- **Teams payload**: uses the legacy `MessageCard` format (`@type`, `@context`, `summary`, `text`).
- **Secrets never reach the browser**: the frontend calls `/api/messages` only; the route handler reads tokens/URLs from `process.env` server-side.

### Tests

Tests live under `tests/` mirroring `lib/` and `app/` structure. Vitest is configured with the `@/` path alias (same as Next.js).

- Unit/API tests use `vitest.config.ts`; this excludes `tests/e2e/**`.
- Relay tests (`tests/relay/`) mock `fetch` directly.
- API route tests (`tests/api/`) mock `@/lib/relay/slack` and `@/lib/relay/teams` at the module level.
- E2E tests use `vitest.config.e2e.ts`; `tests/e2e/setup.ts` starts a mock webhook server on port 19999 and a Next dev server on port 3099.
