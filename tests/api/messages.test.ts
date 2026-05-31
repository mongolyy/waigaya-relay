import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  getSlackBotToken: vi.fn(() => 'xoxb-test-token'),
  getSlackChannelId: vi.fn(() => 'C0TEST'),
  getTeamsWebhookUrl: vi.fn(() => 'https://outlook.office.com/test'),
}))

vi.mock('@/lib/relay/slack', () => ({
  postToSlack: vi.fn(),
}))

vi.mock('@/lib/relay/teams', () => ({
  postToTeams: vi.fn(),
}))

vi.mock('@/lib/session-store', () => ({
  getSessionThread: vi.fn(),
  saveSessionThread: vi.fn(),
}))

import { POST } from '@/app/api/messages/route'
import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import { getSessionThread, saveSessionThread } from '@/lib/session-store'
import type { RelayResult } from '@/lib/types'

const SUCCESS_SLACK: RelayResult = {
  target: 'slack',
  ok: true,
  skipped: false,
  ts: '1700000000.000100',
}
const SUCCESS_TEAMS: RelayResult = {
  target: 'teams',
  ok: true,
  skipped: false,
}
const SKIPPED_SLACK: RelayResult = {
  target: 'slack',
  ok: false,
  skipped: true,
}
const SKIPPED_TEAMS: RelayResult = {
  target: 'teams',
  ok: false,
  skipped: true,
}
const FAILED_SLACK: RelayResult = {
  target: 'slack',
  ok: false,
  skipped: false,
  detail: 'HTTP 500',
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(postToSlack).mockResolvedValue(SUCCESS_SLACK)
    vi.mocked(postToTeams).mockResolvedValue(SUCCESS_TEAMS)
    vi.mocked(getSessionThread).mockResolvedValue(null)
    vi.mocked(saveSessionThread).mockResolvedValue(undefined)
  })

  describe('input validation', () => {
    it('returns 400 on invalid JSON body', async () => {
      const req = new Request('http://localhost/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Invalid request body.')
    })

    it('returns 400 when message is missing', async () => {
      const res = await POST(makeRequest({}))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toBe('Message must not be empty.')
    })

    it('returns 400 when message is an empty string', async () => {
      const res = await POST(makeRequest({ message: '' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
    })

    it('returns 400 when message is whitespace only', async () => {
      const res = await POST(makeRequest({ message: '   ' }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
    })

    it('returns 400 when message exceeds 4000 characters', async () => {
      const res = await POST(makeRequest({ message: 'a'.repeat(4001) }))
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain('4000')
    })

    it('accepts a message of exactly 4000 characters', async () => {
      const res = await POST(makeRequest({ message: 'a'.repeat(4000) }))
      expect(res.status).toBe(200)
    })
  })

  describe('relay logic', () => {
    it('returns 200 ok:true when all relays succeed', async () => {
      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.results).toHaveLength(2)
    })

    it('returns 200 ok:false when all relays are skipped', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(SKIPPED_SLACK)
      vi.mocked(postToTeams).mockResolvedValueOnce(SKIPPED_TEAMS)
      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
    })

    it('returns 200 ok:false when at least one relay fails', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
    })

    it('returns 200 ok:true when one relay is skipped and the other succeeds', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(SKIPPED_SLACK)
      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it('trims whitespace from the message before relaying', async () => {
      await POST(makeRequest({ message: '  hello  ' }))
      expect(postToSlack).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'xoxb-test-token',
          channel: 'C0TEST',
        }),
        'hello',
        undefined,
      )
      expect(postToTeams).toHaveBeenCalledWith(expect.any(String), 'hello')
    })

    it('includes all relay results in the response body', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      vi.mocked(postToTeams).mockResolvedValueOnce(SUCCESS_TEAMS)
      const res = await POST(makeRequest({ message: 'hello' }))
      const data = await res.json()
      expect(data.results).toContainEqual(FAILED_SLACK)
      expect(data.results).toContainEqual(SUCCESS_TEAMS)
    })
  })

  describe('session threading', () => {
    it('starts a new thread and saves its ts on the first post of a session', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce(null)
      await POST(makeRequest({ message: 'first', sessionId: 'sess-1' }))

      // No existing thread → Slack is called without thread_ts.
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(Object),
        'first',
        undefined,
      )
      // The returned ts is persisted as the session's thread anchor.
      expect(saveSessionThread).toHaveBeenCalledWith('sess-1', {
        slackThreadTs: '1700000000.000100',
      })
    })

    it('replies into the existing thread on later posts of the same session', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce({
        slackThreadTs: '1700000000.000100',
      })
      await POST(makeRequest({ message: 'second', sessionId: 'sess-1' }))

      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(Object),
        'second',
        '1700000000.000100',
      )
      // The anchor already exists, so it is not rewritten.
      expect(saveSessionThread).not.toHaveBeenCalled()
    })

    it('does not save a thread when Slack fails on the first post', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce(null)
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      await POST(makeRequest({ message: 'first', sessionId: 'sess-2' }))
      expect(saveSessionThread).not.toHaveBeenCalled()
    })

    it('does not look up or save threads when no sessionId is provided', async () => {
      await POST(makeRequest({ message: 'no session' }))
      expect(getSessionThread).not.toHaveBeenCalled()
      expect(saveSessionThread).not.toHaveBeenCalled()
    })
  })
})
