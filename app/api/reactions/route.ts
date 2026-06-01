import { NextResponse } from 'next/server'
import type { AddReactionRequest } from '@/lib/types'
import {
  addReaction,
  getReactions,
  removeReaction,
} from '@/lib/usecase/reaction'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const result = await getReactions(searchParams.get('messageId'))

  if (result.kind === 'validation_error') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    )
  }
  if (result.kind === 'not_found') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 404 },
    )
  }
  return NextResponse.json({ reactions: result.reactions })
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

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const { messageId, emoji } = body as Partial<AddReactionRequest>
  const result = await addReaction(messageId, emoji)

  if (result.kind === 'validation_error') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    )
  }
  if (result.kind === 'not_found') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 404 },
    )
  }
  return NextResponse.json({ reactions: result.reactions })
}

export async function DELETE(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const { messageId, emoji } = body as Partial<AddReactionRequest>
  const result = await removeReaction(messageId, emoji)

  if (result.kind === 'validation_error') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    )
  }
  if (result.kind === 'not_found') {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 404 },
    )
  }
  return NextResponse.json({ reactions: result.reactions })
}
