import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  getSlackBotToken,
  getSlackChannelId,
  getTeamsWebhookUrl,
} from '@/lib/config'
import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import { getSessionThread, saveSessionThread } from '@/lib/session-store'
import { createMessage } from '@/lib/store'
import type { PostMessageResponse, RelayResult } from '@/lib/types'

const MAX_MESSAGE_LENGTH = 4000

// Run on the Node.js runtime to allow outbound fetch to external services.
export const runtime = 'nodejs'

/** Relay a message to Slack and/or Teams. */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const rawMessage =
    typeof (body as { message?: unknown })?.message === 'string'
      ? (body as { message: string }).message
      : ''
  const message = rawMessage.trim()

  // Optional: groups all messages of one chat log into a single thread.
  const sessionId =
    typeof (body as { sessionId?: unknown })?.sessionId === 'string'
      ? (body as { sessionId: string }).sessionId.trim()
      : ''

  if (!message) {
    return NextResponse.json(
      { ok: false, error: 'Message must not be empty.' },
      { status: 400 },
    )
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      },
      { status: 400 },
    )
  }

  const messageId = randomUUID()
  createMessage(messageId, message)

  // Look up the existing Slack thread anchor for this session, if any.
  const session = sessionId ? await getSessionThread(sessionId) : null
  const slackThreadTs = session?.slackThreadTs

  // Post to Slack and Teams independently so one failure does not affect the other.
  const results: RelayResult[] = await Promise.all([
    postToSlack(
      { token: getSlackBotToken(), channel: getSlackChannelId() },
      message,
      slackThreadTs,
    ),
    postToTeams(getTeamsWebhookUrl(), message),
  ])

  // On the first successful Slack post of a session, remember its ts so later
  // messages in the same session reply into that thread.
  if (sessionId && !slackThreadTs) {
    const slack = results.find((r) => r.target === 'slack')
    if (slack?.ok && slack.ts) {
      await saveSessionThread(sessionId, { slackThreadTs: slack.ts })
    }
  }

  // ok is true only when at least one relay ran and all executed relays succeeded.
  const executed = results.filter((r) => !r.skipped)
  const ok = executed.length > 0 && executed.every((r) => r.ok)

  const response: PostMessageResponse = { ok, results, messageId }
  // Always return 200 so CDNs (e.g. Vercel) don't replace the JSON body
  // with an HTML error page, which would break the frontend's JSON parsing.
  return NextResponse.json(response, { status: 200 })
}
