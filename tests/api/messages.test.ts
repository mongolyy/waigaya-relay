import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  getSlackWebhookUrl: vi.fn(() => 'https://hooks.slack.com/test'),
  getTeamsWebhookUrl: vi.fn(() => 'https://outlook.office.com/test'),
}))

vi.mock('@/lib/relay/slack', () => ({
  postToSlack: vi.fn(),
}))

vi.mock('@/lib/relay/teams', () => ({
  postToTeams: vi.fn(),
}))

import { POST } from '@/app/api/messages/route'
import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import type { RelayResult } from '@/lib/types'

const SUCCESS_SLACK: RelayResult = {
  target: 'slack',
  ok: true,
  skipped: false,
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
    vi.mocked(postToSlack).mockResolvedValue(SUCCESS_SLACK)
    vi.mocked(postToTeams).mockResolvedValue(SUCCESS_TEAMS)
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
        expect.any(String),
        'hello',
        undefined,
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.any(String),
        'hello',
        undefined,
      )
    })

    it('passes username to relay functions when provided', async () => {
      await POST(makeRequest({ message: 'hello', username: 'Alice' }))
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(String),
        'hello',
        'Alice',
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.any(String),
        'hello',
        'Alice',
      )
    })

    it('passes undefined username when username is empty or whitespace', async () => {
      await POST(makeRequest({ message: 'hello', username: '   ' }))
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(String),
        'hello',
        undefined,
      )
    })

    it('passes undefined username when username is absent', async () => {
      await POST(makeRequest({ message: 'hello' }))
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(String),
        'hello',
        undefined,
      )
    })

    it('returns 400 when username exceeds 80 characters', async () => {
      const res = await POST(
        makeRequest({ message: 'hello', username: 'a'.repeat(81) }),
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain('80')
    })

    it('accepts a username of exactly 80 characters', async () => {
      const res = await POST(
        makeRequest({ message: 'hello', username: 'a'.repeat(80) }),
      )
      expect(res.status).toBe(200)
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
})
