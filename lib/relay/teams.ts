import { getTeamsBotLoginUrl, getTeamsBotServiceUrl } from '@/lib/config'
import type { RelayResult } from '@/lib/types'

const BOT_TIMEOUT_MS = 5000

export interface TeamsConfig {
  appId: string | undefined
  appPassword: string | undefined
  tenantId: string | undefined
  channelId: string | undefined
}

export interface TeamsPostOptions {
  /** When set, post as a reply within this conversation thread. */
  conversationId?: string
  /** Author name; prepended to the message text when present. */
  username?: string
}

// Module-level token promise cache — reused across concurrent and subsequent
// calls until expiry, preventing duplicate token requests under load.
let tokenPromise: Promise<string> | null = null
let tokenExpiresAt = 0

/** Test helper: clears the cached Bot Framework access token. */
export function _resetTokenCacheForTests(): void {
  tokenPromise = null
  tokenExpiresAt = 0
}

// Replaces markdown special characters in username with full-width equivalents
// so they don't break the **bold** wrapper in Teams markdown rendering.
function escapeUsername(text: string): string {
  return text
    .replace(/\*/g, '＊')
    .replace(/_/g, '＿')
    .replace(/~/g, '～')
    .replace(/`/g, '｀')
}

async function getBotToken(
  tenantId: string,
  appId: string,
  appPassword: string,
): Promise<string> {
  if (tokenPromise && Date.now() < tokenExpiresAt) {
    return tokenPromise
  }

  tokenPromise = (async () => {
    try {
      const res = await fetch(
        `${getTeamsBotLoginUrl()}/${tenantId}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: appId,
            client_secret: appPassword,
            scope: 'https://api.botframework.com/.default',
          }).toString(),
          signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
        },
      )
      if (!res.ok) {
        throw new Error(`Bot token request failed (HTTP ${res.status})`)
      }
      const data = (await res.json()) as {
        access_token: string
        expires_in: number
      }
      // Subtract a 60-second buffer so the token is refreshed before it actually expires.
      tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
      return data.access_token
    } catch (err) {
      tokenPromise = null
      tokenExpiresAt = 0
      throw err
    }
  })()

  return tokenPromise
}

/**
 * Post a message to a Microsoft Teams channel via the Bot Connector REST API.
 *
 * When `conversationId` is absent a new conversation thread is started and the
 * returned result carries the `conversationId`, which the caller stores as the
 * thread anchor for later posts in the same session. When `conversationId` is
 * provided the message is posted as a reply within that thread.
 */
export async function postToTeams(
  { appId, appPassword, tenantId, channelId }: TeamsConfig,
  message: string,
  { conversationId, username }: TeamsPostOptions = {},
): Promise<RelayResult> {
  if (!appId || !appPassword || !tenantId || !channelId) {
    return {
      target: 'teams',
      ok: false,
      skipped: true,
      detail: 'Teams Bot is not configured — Teams relay skipped.',
    }
  }

  const text = username
    ? `**${escapeUsername(username)}**: ${message}`
    : message

  try {
    const token = await getBotToken(tenantId, appId, appPassword)
    const serviceUrl = getTeamsBotServiceUrl()

    if (!conversationId) {
      // Start a new conversation thread.
      const res = await fetch(`${serviceUrl}/v3/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isGroup: true,
          channelData: { channel: { id: channelId }, tenant: { id: tenantId } },
          activity: { type: 'message', text },
          bot: { id: appId },
        }),
        signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
      })

      if (!res.ok) {
        const rawBody = await res.text().catch(() => '')
        const body =
          rawBody.length > 200 ? `${rawBody.substring(0, 200)}...` : rawBody
        return {
          target: 'teams',
          ok: false,
          skipped: false,
          detail: `Teams post failed (HTTP ${res.status})${body ? `: ${body}` : ''}`,
        }
      }

      const data = (await res.json()) as { id: string }
      return {
        target: 'teams',
        ok: true,
        skipped: false,
        conversationId: data.id,
      }
    }

    // Reply into the existing conversation thread.
    const res = await fetch(
      `${serviceUrl}/v3/conversations/${conversationId}/activities`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'message', text }),
        signal: AbortSignal.timeout(BOT_TIMEOUT_MS),
      },
    )

    if (!res.ok) {
      const rawBody = await res.text().catch(() => '')
      const body =
        rawBody.length > 200 ? `${rawBody.substring(0, 200)}...` : rawBody
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
      ? `Teams post timed out (${BOT_TIMEOUT_MS}ms).`
      : `Teams post failed: ${errorMessage}`
    return { target: 'teams', ok: false, skipped: false, detail }
  }
}
