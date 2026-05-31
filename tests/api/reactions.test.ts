import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reset the store module between tests so reactions don't leak across test cases.
vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/store')>(
    '@/lib/store',
  )
  return actual
})

import { GET, POST } from '@/app/api/reactions/route'
import { createMessage } from '@/lib/store'

function makeGetRequest(messageId: string): Request {
  return new Request(
    `http://localhost/api/reactions?messageId=${messageId}`,
    { method: 'GET' },
  )
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/reactions', () => {
  it('returns 400 when messageId is missing', async () => {
    const req = new Request('http://localhost/api/reactions', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown messageId', async () => {
    const res = await GET(makeGetRequest('non-existent-id'))
    expect(res.status).toBe(404)
  })

  it('returns empty reactions for a newly created message', async () => {
    createMessage('msg-1', 'hello')
    const res = await GET(makeGetRequest('msg-1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reactions).toEqual({})
  })
})

describe('POST /api/reactions', () => {
  beforeEach(() => {
    createMessage('msg-2', 'test message')
  })

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when messageId or emoji is missing', async () => {
    const res = await POST(makePostRequest({ messageId: 'msg-2' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown messageId', async () => {
    const res = await POST(
      makePostRequest({ messageId: 'no-such-id', emoji: '👍' }),
    )
    expect(res.status).toBe(404)
  })

  it('increments reaction count', async () => {
    const res = await POST(makePostRequest({ messageId: 'msg-2', emoji: '👍' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reactions['👍']).toBe(1)
  })

  it('accumulates multiple reactions on the same emoji', async () => {
    await POST(makePostRequest({ messageId: 'msg-2', emoji: '❤️' }))
    const res = await POST(
      makePostRequest({ messageId: 'msg-2', emoji: '❤️' }),
    )
    const data = await res.json()
    expect(data.reactions['❤️']).toBe(2)
  })

  it('tracks different emojis independently', async () => {
    await POST(makePostRequest({ messageId: 'msg-2', emoji: '👍' }))
    await POST(makePostRequest({ messageId: 'msg-2', emoji: '😄' }))
    const res = await GET(makeGetRequest('msg-2'))
    const data = await res.json()
    expect(data.reactions['👍']).toBe(1)
    expect(data.reactions['😄']).toBe(1)
  })
})
