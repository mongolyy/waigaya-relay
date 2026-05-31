import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSlackWebhookUrl, getTeamsWebhookUrl } from '@/lib/config'
import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import { createMessage } from '@/lib/store'
import type { PostMessageResponse, RelayResult } from '@/lib/types'

const MAX_MESSAGE_LENGTH = 4000

// Run on the Node.js runtime to allow outbound fetch to external webhooks.
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

  const b = body as { message?: unknown; username?: unknown }
  const rawMessage = typeof b?.message === 'string' ? b.message : ''
  const message = rawMessage.trim()

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

  const username =
    typeof b?.username === 'string' ? b.username.trim() || undefined : undefined

  const MAX_USERNAME_LENGTH = 80
  if (username && username.length > MAX_USERNAME_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Username is too long (max ${MAX_USERNAME_LENGTH} characters).`,
      },
      { status: 400 },
    )
  }

  const messageId = randomUUID()
  createMessage(messageId, message)

  // Post to Slack and Teams independently so one failure does not affect the other.
  const results: RelayResult[] = await Promise.all([
    postToSlack(getSlackWebhookUrl(), message, username),
    postToTeams(getTeamsWebhookUrl(), message, username),
  ])

  // ok is true only when at least one relay ran and all executed relays succeeded.
  const executed = results.filter((r) => !r.skipped)
  const ok = executed.length > 0 && executed.every((r) => r.ok)

  const response: PostMessageResponse = { ok, results, messageId }
  // Always return 200 so CDNs (e.g. Vercel) don't replace the JSON body
  // with an HTML error page, which would break the frontend's JSON parsing.
  return NextResponse.json(response, { status: 200 })
}
