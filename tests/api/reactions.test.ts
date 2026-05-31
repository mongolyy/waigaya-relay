import { beforeEach, describe, expect, it } from 'vitest'
import { DELETE, GET, POST } from '@/app/api/reactions/route'
import { clearStore, createMessage } from '@/lib/store'

beforeEach(() => {
  clearStore()
})

function makeGetRequest(messageId: string): Request {
  return new Request(`http://localhost/api/reactions?messageId=${messageId}`, {
    method: 'GET',
  })
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

  it('returns 400 when body is null', async () => {
    const res = await POST(makePostRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 400 when messageId or emoji is missing', async () => {
    const res = await POST(makePostRequest({ messageId: 'msg-2' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an unsupported emoji', async () => {
    const res = await POST(makePostRequest({ messageId: 'msg-2', emoji: '🦄' }))
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
    const res = await POST(makePostRequest({ messageId: 'msg-2', emoji: '❤️' }))
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

describe('DELETE /api/reactions', () => {
  beforeEach(() => {
    createMessage('msg-3', 'test message')
  })

  function makeDeleteRequest(body: unknown): Request {
    return new Request('http://localhost/api/reactions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 400 when body is null', async () => {
    const res = await DELETE(makeDeleteRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an unsupported emoji', async () => {
    const res = await DELETE(
      makeDeleteRequest({ messageId: 'msg-3', emoji: '🦄' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown messageId', async () => {
    const res = await DELETE(
      makeDeleteRequest({ messageId: 'no-such-id', emoji: '👍' }),
    )
    expect(res.status).toBe(404)
  })

  it('decrements reaction count', async () => {
    await POST(makePostRequest({ messageId: 'msg-3', emoji: '👍' }))
    await POST(makePostRequest({ messageId: 'msg-3', emoji: '👍' }))
    const res = await DELETE(
      makeDeleteRequest({ messageId: 'msg-3', emoji: '👍' }),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.reactions['👍']).toBe(1)
  })

  it('removes the emoji key when count reaches zero', async () => {
    await POST(makePostRequest({ messageId: 'msg-3', emoji: '👍' }))
    const res = await DELETE(
      makeDeleteRequest({ messageId: 'msg-3', emoji: '👍' }),
    )
    const data = await res.json()
    expect(data.reactions['👍']).toBeUndefined()
  })
})
