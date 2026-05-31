# waigaya-relay 📣

> [日本語版はこちら](./README.ja.md)

Post a message from the web chat UI and it will be relayed to both **Slack** and **Microsoft Teams**, creating a thread-starter message in each channel.

The goal is not just forwarding messages — it's about **sparking lively discussions**. Team members can reply directly in Slack or Teams, turning each post into an ongoing conversation thread.

Built with Next.js (App Router) and ready to deploy on **Vercel**.

---

## Features

- Send messages from a simple web chat interface
- Messages are posted to both **Slack** and **Microsoft Teams** simultaneously
- Each platform receives a thread-starter message that teammates can reply to
- If one platform fails, the other still succeeds — results for each (success / failure / skipped) are shown individually

---

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router) / React 18
- TypeScript
- Slack / Microsoft Teams Incoming Webhooks
- Hosting: [Vercel](https://vercel.com/)

---

## Usage

### 1. Open the chat UI

Navigate to the app URL (e.g. `http://localhost:3000` locally, or the Vercel URL after deployment). You'll see the message input screen.

![Initial screen — empty message input](./docs/screenshots/01_initial.png)

### 2. Type a message

Write a message to post. You can use newlines to add structure — the content is relayed as-is to each platform.

![Message typed in the textarea](./docs/screenshots/02_with_message.png)

### 3. Click Send and check results

Click the **Send** button. The result for each relay target — Slack and Microsoft Teams — is shown immediately below. Unconfigured targets show as **skipped**.

![After sending — success status for each target](./docs/screenshots/03_result_success.png)

| Status | Meaning |
| ------ | ------- |
| `success` | Message was delivered to the platform |
| `failed`  | Delivery failed (check the detail message) |
| `skipped` | Webhook URL not configured — relay was not attempted |

### 4. Reply in Slack / Teams to start the discussion

Once the message lands in your Slack channel or Teams channel, team members can reply directly in the thread. That's the whole point — the relayed message becomes the starting point for a focused discussion.

---

## Setup

### 1. Prerequisites

- Node.js 20+
- Slack Incoming Webhook URL (optional)
- Microsoft Teams Incoming Webhook URL (optional)

> The app works with either Slack or Teams alone. Unconfigured destinations are skipped automatically.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Webhook URLs.

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxx/xxxx/xxxx
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/xxxx/IncomingWebhook/xxxx/xxxx
```

> ⚠️ `.env.local` is already in `.gitignore`. **Never commit your Webhook URLs.**

#### How to get Webhook URLs

- **Slack**: Follow the [Incoming Webhooks](https://api.slack.com/messaging/webhooks) guide and generate a URL for your target channel.
- **Microsoft Teams**: Go to the desired channel's Connectors settings, add **Incoming Webhook**, and copy the generated URL.

---

## Environment Variables

| Variable            | Required | Description                                                         |
| ------------------- | -------- | ------------------------------------------------------------------- |
| `SLACK_WEBHOOK_URL` | Optional | Slack Incoming Webhook URL. If unset, Slack relay is skipped.       |
| `TEAMS_WEBHOOK_URL` | Optional | Teams Incoming Webhook URL. If unset, Teams relay is skipped.       |

- At least one must be set (if both are unset, every post will be skipped and treated as a failure).
- For local development use `.env.local`; on Vercel use **Project → Settings → Environment Variables**.

---

## Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To test a production build:

```bash
npm run build
npm start
```

Other commands:

```bash
npm run typecheck   # type check only
```

---

## Testing the App

1. Start the server with `npm run dev`.
2. Open [http://localhost:3000](http://localhost:3000).
3. Type a message and click **Send**.
4. The relay results (success / failure / skipped for each of Slack and Teams) are shown below the input.
5. Verify the message arrived in your Slack / Teams channel.
6. Reply to the message in Slack / Teams to start a thread discussion.

You can also test the API directly:

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from waigaya-relay!"}'
```

Example response:

```json
{
  "ok": true,
  "results": [
    { "target": "slack", "ok": true, "skipped": false },
    { "target": "teams", "ok": true, "skipped": false }
  ]
}
```

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it as a **New Project** on [Vercel](https://vercel.com/).
   (Next.js is auto-detected — no build configuration changes needed.)
3. Add `SLACK_WEBHOOK_URL` and `TEAMS_WEBHOOK_URL` under **Settings → Environment Variables**.
4. Click **Deploy**.

After deployment, the chat UI is available at the issued URL.
Redeploy after changing environment variables.

---

## Security Notes

- **Webhook URLs are secrets.** Never hardcode them — always pass them via environment variables.
- `.env*` files are gitignored. Do not commit them.
- Relay logic runs server-side only (API Route). Webhook URLs are never exposed to the browser; the frontend only calls `/api/messages`.
- Webhook URLs are not written to logs.
- This prototype has **no authentication or rate limiting**. Use it as an internal tool with restricted access, or add auth and rate limiting before exposing it publicly. (HTTPS is enabled by default on Vercel.)

---

## Directory Structure

```
waigaya-relay/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Chat UI (client component)
│   ├── globals.css                # Styles
│   └── api/messages/route.ts      # Message relay API (POST)
├── lib/
│   ├── config.ts                  # Environment variable loading
│   ├── types.ts                   # Shared type definitions
│   └── relay/
│       ├── slack.ts               # Slack Webhook posting
│       └── teams.ts               # Teams Webhook posting
├── docs/plan/                     # Implementation plan
├── .env.example
├── next.config.mjs
├── package.json
└── tsconfig.json
```

See [`docs/plan/20260529_waigaya-relay.md`](./docs/plan/20260529_waigaya-relay.md) for the implementation plan.

---

## License

[MIT](./LICENSE)
