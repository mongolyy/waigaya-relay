import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  getSlackWebhookConfig: vi.fn(() => ({
    url: 'https://hooks.slack.com/test',
    inCooldown: false,
  })),
  getTeamsWebhookConfig: vi.fn(() => ({
    url: 'https://outlook.office.com/test',
    inCooldown: false,
  })),
}))

vi.mock('@/lib/relay/slack', () => ({
  postToSlack: vi.fn(),
}))

vi.mock('@/lib/relay/teams', () => ({
  postToTeams: vi.fn(),
}))

import { POST } from '@/app/api/messages/route'
import { getSlackWebhookConfig, getTeamsWebhookConfig } from '@/lib/config'
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
    vi.clearAllMocks()
    vi.mocked(postToSlack).mockResolvedValue(SUCCESS_SLACK)
    vi.mocked(postToTeams).mockResolvedValue(SUCCESS_TEAMS)
    vi.mocked(getSlackWebhookConfig).mockReturnValue({
      url: 'https://hooks.slack.com/test',
      inCooldown: false,
    })
    vi.mocked(getTeamsWebhookConfig).mockReturnValue({
      url: 'https://outlook.office.com/test',
      inCooldown: false,
    })
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
      expect(postToSlack).toHaveBeenCalledWith(expect.any(String), 'hello')
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

  describe('cooldown', () => {
    it('skips Slack relay and returns ok:false when Slack is in cooldown', async () => {
      vi.mocked(getSlackWebhookConfig).mockReturnValueOnce({
        url: 'https://hooks.slack.com/test',
        inCooldown: true,
      })
      vi.mocked(postToTeams).mockResolvedValueOnce(SKIPPED_TEAMS)

      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(postToSlack).not.toHaveBeenCalled()

      const slackResult = data.results.find(
        (r: RelayResult) => r.target === 'slack',
      )
      expect(slackResult.skipped).toBe(true)
      expect(slackResult.detail).toContain('cooldown')
    })

    it('skips Teams relay and returns ok:false when Teams is in cooldown', async () => {
      vi.mocked(getTeamsWebhookConfig).mockReturnValueOnce({
        url: 'https://outlook.office.com/test',
        inCooldown: true,
      })
      vi.mocked(postToSlack).mockResolvedValueOnce(SKIPPED_SLACK)

      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(postToTeams).not.toHaveBeenCalled()

      const teamsResult = data.results.find(
        (r: RelayResult) => r.target === 'teams',
      )
      expect(teamsResult.skipped).toBe(true)
      expect(teamsResult.detail).toContain('cooldown')
    })

    it('returns ok:true when one relay is in cooldown but the other succeeds', async () => {
      vi.mocked(getSlackWebhookConfig).mockReturnValueOnce({
        url: 'https://hooks.slack.com/test',
        inCooldown: true,
      })

      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })

    it('returns ok:false when both relays are in cooldown', async () => {
      vi.mocked(getSlackWebhookConfig).mockReturnValueOnce({
        url: 'https://hooks.slack.com/test',
        inCooldown: true,
      })
      vi.mocked(getTeamsWebhookConfig).mockReturnValueOnce({
        url: 'https://outlook.office.com/test',
        inCooldown: true,
      })

      const res = await POST(makeRequest({ message: 'hello' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(postToSlack).not.toHaveBeenCalled()
      expect(postToTeams).not.toHaveBeenCalled()
    })
  })
})
