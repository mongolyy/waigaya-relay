import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  getSlackBotToken: vi.fn(() => 'xoxb-test-token'),
  getSlackChannelId: vi.fn(() => 'C0TEST'),
  getTeamsBotAppId: vi.fn(() => 'test-app-id'),
  getTeamsBotAppPassword: vi.fn(() => 'test-password'),
  getTeamsBotTenantId: vi.fn(() => 'test-tenant'),
  getTeamsChannelId: vi.fn(() => '19:test@thread.tacv2'),
  getTeamsWebhookUrl: vi.fn(() => undefined),
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

vi.mock('@/lib/store', () => ({
  createMessage: vi.fn(),
}))

import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import { getSessionThread, saveSessionThread } from '@/lib/session-store'
import { createMessage } from '@/lib/store'
import type { RelayResult } from '@/lib/types'
import { relayMessage } from '@/lib/usecase/relayMessage'

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
  conversationId: 'conv-123',
}
const SKIPPED_SLACK: RelayResult = { target: 'slack', ok: false, skipped: true }
const SKIPPED_TEAMS: RelayResult = { target: 'teams', ok: false, skipped: true }
const FAILED_SLACK: RelayResult = {
  target: 'slack',
  ok: false,
  skipped: false,
  detail: 'HTTP 500',
}

describe('relayMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createMessage).mockResolvedValue({
      id: 'x',
      text: 'x',
      createdAt: '',
      reactions: {},
    })
    vi.mocked(postToSlack).mockResolvedValue(SUCCESS_SLACK)
    vi.mocked(postToTeams).mockResolvedValue(SUCCESS_TEAMS)
    vi.mocked(getSessionThread).mockResolvedValue(null)
    vi.mocked(saveSessionThread).mockResolvedValue(undefined)
  })

  describe('validation', () => {
    it('rejects an empty message', async () => {
      const result = await relayMessage({ message: '   ' })
      expect(result).toEqual({
        kind: 'validation_error',
        error: 'Message must not be empty.',
      })
    })

    it('rejects a non-string message', async () => {
      const result = await relayMessage({ message: 42 })
      expect(result.kind).toBe('validation_error')
    })

    it('rejects a message over 4000 characters', async () => {
      const result = await relayMessage({ message: 'a'.repeat(4001) })
      expect(result.kind).toBe('validation_error')
      if (result.kind === 'validation_error') {
        expect(result.error).toContain('4000')
      }
    })

    it('rejects a username over 80 characters', async () => {
      const result = await relayMessage({
        message: 'hello',
        username: 'a'.repeat(81),
      })
      expect(result.kind).toBe('validation_error')
      if (result.kind === 'validation_error') {
        expect(result.error).toContain('80')
      }
    })

    it('rejects an invalid sessionId format', async () => {
      const result = await relayMessage({
        message: 'hello',
        sessionId: 'bad:format!',
      })
      expect(result).toEqual({
        kind: 'validation_error',
        error: 'Invalid sessionId format.',
      })
    })
  })

  describe('relay orchestration', () => {
    it('creates the message and relays to both destinations', async () => {
      const result = await relayMessage({ message: '  hello  ' })
      expect(createMessage).toHaveBeenCalledWith(
        'default',
        expect.any(String),
        'hello',
        undefined,
      )
      expect(postToSlack).toHaveBeenCalledWith(
        { token: 'xoxb-test-token', channel: 'C0TEST' },
        'hello',
        { threadTs: undefined, username: undefined },
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.objectContaining({ appId: 'test-app-id', webhookUrl: undefined }),
        'hello',
        { conversationId: undefined, username: undefined },
      )
      expect(result.kind).toBe('success')
    })

    it('reports ok:true when all relays succeed', async () => {
      const result = await relayMessage({ message: 'hello' })
      if (result.kind !== 'success') throw new Error('expected success')
      expect(result.response.ok).toBe(true)
      expect(result.response.results).toHaveLength(2)
      expect(result.response.messageId).toEqual(expect.any(String))
    })

    it('reports ok:false when all relays are skipped', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(SKIPPED_SLACK)
      vi.mocked(postToTeams).mockResolvedValueOnce(SKIPPED_TEAMS)
      const result = await relayMessage({ message: 'hello' })
      if (result.kind !== 'success') throw new Error('expected success')
      expect(result.response.ok).toBe(false)
    })

    it('reports ok:false when one relay fails', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      const result = await relayMessage({ message: 'hello' })
      if (result.kind !== 'success') throw new Error('expected success')
      expect(result.response.ok).toBe(false)
    })

    it('reports ok:true when one relay is skipped and the other succeeds', async () => {
      vi.mocked(postToSlack).mockResolvedValueOnce(SKIPPED_SLACK)
      const result = await relayMessage({ message: 'hello' })
      if (result.kind !== 'success') throw new Error('expected success')
      expect(result.response.ok).toBe(true)
    })

    it('passes a trimmed username through to both relays', async () => {
      await relayMessage({ message: 'hello', username: '  Alice  ' })
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(Object),
        'hello',
        expect.objectContaining({ username: 'Alice' }),
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.any(Object),
        'hello',
        expect.objectContaining({ username: 'Alice' }),
      )
    })
  })

  describe('session threading', () => {
    it('saves anchors for both relays on the first post of a session', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce(null)
      await relayMessage({ message: 'first', sessionId: 'aaaaaaaaaaaa' })
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(Object),
        'first',
        expect.objectContaining({ threadTs: undefined }),
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.any(Object),
        'first',
        expect.objectContaining({ conversationId: undefined }),
      )
      expect(saveSessionThread).toHaveBeenCalledWith('aaaaaaaaaaaa', {
        slackThreadTs: '1700000000.000100',
        teamsThreadId: 'conv-123',
      })
    })

    it('replies into existing threads without re-saving anchors', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce({
        slackThreadTs: '1700000000.000100',
        teamsThreadId: 'conv-123',
      })
      await relayMessage({ message: 'second', sessionId: 'aaaaaaaaaaaa' })
      expect(postToSlack).toHaveBeenCalledWith(
        expect.any(Object),
        'second',
        expect.objectContaining({ threadTs: '1700000000.000100' }),
      )
      expect(postToTeams).toHaveBeenCalledWith(
        expect.any(Object),
        'second',
        expect.objectContaining({ conversationId: 'conv-123' }),
      )
      expect(saveSessionThread).not.toHaveBeenCalled()
    })

    it('does not save an anchor when no relay establishes one on the first post', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce(null)
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      vi.mocked(postToTeams).mockResolvedValueOnce(SKIPPED_TEAMS)
      await relayMessage({ message: 'first', sessionId: 'bbbbbbbbbbbb' })
      expect(saveSessionThread).not.toHaveBeenCalled()
    })

    it('saves only the Teams anchor when Slack fails on the first post', async () => {
      vi.mocked(getSessionThread).mockResolvedValueOnce(null)
      vi.mocked(postToSlack).mockResolvedValueOnce(FAILED_SLACK)
      await relayMessage({ message: 'first', sessionId: 'cccccccccccc' })
      expect(saveSessionThread).toHaveBeenCalledWith('cccccccccccc', {
        teamsThreadId: 'conv-123',
      })
    })

    it('does not look up or save threads without a sessionId', async () => {
      await relayMessage({ message: 'no session' })
      expect(getSessionThread).not.toHaveBeenCalled()
      expect(saveSessionThread).not.toHaveBeenCalled()
    })
  })
})
