import { getSlackApiBaseUrl } from '@/lib/config'
import type { RelayResult } from '@/lib/types'

/** Timeout in ms to avoid hanging indefinitely when Slack is unresponsive. */
const SLACK_TIMEOUT_MS = 5000

export interface SlackConfig {
  /** Bot token (`xoxb-…`). */
  token: string | undefined
  /** Target channel id. */
  channel: string | undefined
}

/**
 * Post a message to Slack via the Web API (`chat.postMessage`).
 *
 * When `threadTs` is provided the message is posted as a reply within that
 * thread; otherwise it starts a new top-level message. On success the returned
 * result carries `ts`, the timestamp of the posted message, which the caller
 * stores as the thread anchor for later posts in the same session.
 */
export async function postToSlack(
  { token, channel }: SlackConfig,
  message: string,
  threadTs?: string,
): Promise<RelayResult> {
  if (!token || !channel) {
    return {
      target: 'slack',
      ok: false,
      skipped: true,
      detail:
        'SLACK_BOT_TOKEN / SLACK_CHANNEL_ID is not set — Slack relay skipped.',
    }
  }

  try {
    const res = await fetch(`${getSlackApiBaseUrl()}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text: message,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })

    if (!res.ok) {
      const rawBody = await res.text().catch(() => '')
      const body =
        rawBody.length > 200 ? `${rawBody.substring(0, 200)}...` : rawBody
      return {
        target: 'slack',
        ok: false,
        skipped: false,
        detail: `Slack post failed (HTTP ${res.status})${body ? `: ${body}` : ''}`,
      }
    }

    // Slack returns HTTP 200 even on application errors; the JSON `ok` field is
    // authoritative, and `ts` is only present on success.
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      ts?: string
      error?: string
    } | null

    if (!data?.ok) {
      return {
        target: 'slack',
        ok: false,
        skipped: false,
        detail: `Slack post failed: ${data?.error ?? 'unknown_error'}`,
      }
    }

    return { target: 'slack', ok: true, skipped: false, ts: data.ts }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    const errorMessage = err instanceof Error ? err.message : String(err)
    const detail = isTimeout
      ? `Slack post timed out (${SLACK_TIMEOUT_MS}ms).`
      : `Slack post failed: ${errorMessage}`
    return { target: 'slack', ok: false, skipped: false, detail }
  }
}
