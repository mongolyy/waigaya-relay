/**
 * 環境変数から Webhook URL を読み取るヘルパー。
 * Vercel ではダッシュボードの Environment Variables、
 * ローカルでは `.env.local` から読み込まれる。
 *
 * Webhook URL はシークレットなので、値をログに出力しないこと。
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function getSlackWebhookUrl(): string | undefined {
  return readOptional('SLACK_WEBHOOK_URL')
}

export function getTeamsWebhookUrl(): string | undefined {
  return readOptional('TEAMS_WEBHOOK_URL')
}
