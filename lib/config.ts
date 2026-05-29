/**
 * Helpers for reading webhook URLs from environment variables.
 * Vercel loads them from the dashboard's Environment Variables settings;
 * local development loads them from `.env.local`.
 *
 * Webhook URLs are secrets, so never log their values.
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getSlackWebhookUrl(): string | undefined {
  return readOptional("SLACK_WEBHOOK_URL");
}

export function getTeamsWebhookUrl(): string | undefined {
  return readOptional("TEAMS_WEBHOOK_URL");
}
