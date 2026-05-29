/**
 * 環境変数から Webhook URL を読み取るヘルパー。
 * Vercel ではダッシュボードの Environment Variables、
 * ローカルでは `.env.local` から読み込まれる。
 *
 * Webhook URL はシークレットなので、値をログに出力しないこと。
 */

/** サプライチェーン攻撃対策: 新しい URL が有効になるまでの待機日数。 */
export const COOLDOWN_DAYS = 3

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export interface WebhookConfig {
  url: string | undefined
  /** true のとき、登録から COOLDOWN_DAYS 日が経過していないため中継をスキップする。 */
  inCooldown: boolean
}

function buildWebhookConfig(
  urlEnvName: string,
  registeredAtEnvName: string,
): WebhookConfig {
  const url = readOptional(urlEnvName)
  if (!url) return { url: undefined, inCooldown: false }

  const registeredAt = readOptional(registeredAtEnvName)
  if (!registeredAt) return { url, inCooldown: false }

  const registeredTime = Date.parse(registeredAt)
  if (Number.isNaN(registeredTime)) return { url, inCooldown: false }

  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const inCooldown = Date.now() - registeredTime < cooldownMs
  return { url, inCooldown }
}

export function getSlackWebhookConfig(): WebhookConfig {
  return buildWebhookConfig('SLACK_WEBHOOK_URL', 'SLACK_WEBHOOK_REGISTERED_AT')
}

export function getTeamsWebhookConfig(): WebhookConfig {
  return buildWebhookConfig('TEAMS_WEBHOOK_URL', 'TEAMS_WEBHOOK_REGISTERED_AT')
}
