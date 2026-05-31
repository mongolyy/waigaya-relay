import { NextResponse } from 'next/server'
import { addReaction, getReactions } from '@/lib/store'
import type { AddReactionRequest, ReactionsResponse } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')

  if (!messageId) {
    return NextResponse.json(
      { ok: false, error: 'messageId is required.' },
      { status: 400 },
    )
  }

  const reactions = getReactions(messageId)
  if (reactions === null) {
    return NextResponse.json(
      { ok: false, error: 'Message not found.' },
      { status: 404 },
    )
  }

  const response: ReactionsResponse = { reactions }
  return NextResponse.json(response)
}

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

  const { messageId, emoji } = body as Partial<AddReactionRequest>

  if (!messageId || !emoji) {
    return NextResponse.json(
      { ok: false, error: 'messageId and emoji are required.' },
      { status: 400 },
    )
  }

  const msg = addReaction(messageId, emoji)
  if (!msg) {
    return NextResponse.json(
      { ok: false, error: 'Message not found.' },
      { status: 404 },
    )
  }

  const response: ReactionsResponse = { reactions: msg.reactions }
  return NextResponse.json(response)
}
