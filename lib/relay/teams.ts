import type { RelayResult } from '@/lib/types'

/** Timeout in ms to avoid hanging indefinitely when the webhook is unresponsive. */
const WEBHOOK_TIMEOUT_MS = 5000

/**
 * Post a message to the Microsoft Teams Incoming Webhook (MessageCard format).
 * The posted message appears in the channel and serves as the thread starter.
 */
export async function postToTeams(
  webhookUrl: string | undefined,
  message: string,
): Promise<RelayResult> {
  if (!webhookUrl) {
    return {
      target: 'teams',
      ok: false,
      skipped: true,
      detail: 'TEAMS_WEBHOOK_URL is not set — Teams relay skipped.',
    }
  }

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: 'waigaya-relay',
    text: message,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })

    if (!res.ok) {
      const rawBody = await res.text().catch(() => '')
      const body =
        rawBody.length > 200 ? rawBody.substring(0, 200) + '...' : rawBody
      return {
        target: 'teams',
        ok: false,
        skipped: false,
        detail: `Teams post failed (HTTP ${res.status})${body ? `: ${body}` : ''}`,
      }
    }

    return { target: 'teams', ok: true, skipped: false }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    const errorMessage = err instanceof Error ? err.message : String(err)
    const detail = isTimeout
      ? `Teams post timed out (${WEBHOOK_TIMEOUT_MS}ms).`
      : `Teams post failed: ${errorMessage}`
    return { target: 'teams', ok: false, skipped: false, detail }
  }
}
