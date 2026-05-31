/**
 * Helpers for reading configuration from environment variables.
 * On Vercel these come from the dashboard's Environment Variables; locally
 * they are read from `.env.local`.
 *
 * Secrets (bot tokens, webhook URLs) must never be logged.
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

/** Slack bot token (`xoxb-…`) used with the Web API `chat.postMessage` endpoint. */
export function getSlackBotToken(): string | undefined {
  return readOptional('SLACK_BOT_TOKEN')
}

/** ID of the Slack channel to post into (e.g. `C0123456789`). */
export function getSlackChannelId(): string | undefined {
  return readOptional('SLACK_CHANNEL_ID')
}

/**
 * Base URL for the Slack Web API. Overridable via `SLACK_API_BASE_URL` (used by
 * tests to point at a mock server); defaults to the real Slack API.
 */
export function getSlackApiBaseUrl(): string {
  return readOptional('SLACK_API_BASE_URL') ?? 'https://slack.com/api'
}

/** True when the Slack relay is fully configured (bot token + channel id). */
export function isSlackConfigured(): boolean {
  return !!getSlackBotToken() && !!getSlackChannelId()
}

export function getTeamsWebhookUrl(): string | undefined {
  return readOptional('TEAMS_WEBHOOK_URL')
}
