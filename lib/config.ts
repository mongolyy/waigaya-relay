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

/** Azure AD App ID for the Teams Bot. */
export function getTeamsBotAppId(): string | undefined {
  return readOptional('TEAMS_BOT_APP_ID')
}

/** Client secret for the Teams Bot Azure AD app. */
export function getTeamsBotAppPassword(): string | undefined {
  return readOptional('TEAMS_BOT_APP_PASSWORD')
}

/** Azure AD tenant ID where the Teams Bot app is registered. */
export function getTeamsBotTenantId(): string | undefined {
  return readOptional('TEAMS_BOT_TENANT_ID')
}

/** Teams channel ID to post into (e.g. `19:...@thread.tacv2`). */
export function getTeamsChannelId(): string | undefined {
  return readOptional('TEAMS_CHANNEL_ID')
}

/**
 * Base URL for the Bot Connector service.
 * Overridable via `TEAMS_BOT_SERVICE_URL` (used by tests to point at a mock
 * server); defaults to the Teams-specific Bot Framework endpoint.
 */
export function getTeamsBotServiceUrl(): string {
  return (
    readOptional('TEAMS_BOT_SERVICE_URL') ??
    'https://smba.trafficmanager.net/teams'
  )
}

/**
 * Base URL for the Microsoft login endpoint (token acquisition).
 * Overridable via `TEAMS_BOT_LOGIN_URL` (used by tests to point at a mock
 * server); defaults to the real Microsoft login endpoint.
 */
export function getTeamsBotLoginUrl(): string {
  return (
    readOptional('TEAMS_BOT_LOGIN_URL') ?? 'https://login.microsoftonline.com'
  )
}

/** True when the Teams Bot relay is fully configured. */
export function isTeamsConfigured(): boolean {
  return (
    !!getTeamsBotAppId() &&
    !!getTeamsBotAppPassword() &&
    !!getTeamsBotTenantId() &&
    !!getTeamsChannelId()
  )
}
