import { NextResponse } from 'next/server'
import { relayMessage } from '@/lib/usecase/relayMessage'

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

  const b = body as { message?: unknown; username?: unknown; sessionId?: unknown }
  const result = await relayMessage({
    message: b?.message,
    username: b?.username,
    sessionId: b?.sessionId,
  })

  if (result.kind === 'validation_error') {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  // Always return 200 so CDNs (e.g. Vercel) don't replace the JSON body
  // with an HTML error page, which would break the frontend's JSON parsing.
  return NextResponse.json(result.response, { status: 200 })
}
