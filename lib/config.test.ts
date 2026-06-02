import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSlackApiBaseUrl,
  getSlackBotToken,
  getSlackChannelId,
  getTeamsWebhookUrl,
  isSlackConfigured,
} from '@/lib/config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSlackBotToken', () => {
  it('returns the configured token', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-abc')
    expect(getSlackBotToken()).toBe('xoxb-abc')
  })

  it('trims surrounding whitespace', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '  xoxb-abc  ')
    expect(getSlackBotToken()).toBe('xoxb-abc')
  })

  it('returns undefined when empty or whitespace only', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '   ')
    expect(getSlackBotToken()).toBeUndefined()
  })

  it('returns undefined when unset', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '')
    expect(getSlackBotToken()).toBeUndefined()
  })
})

describe('getSlackChannelId', () => {
  it('returns the configured channel id', () => {
    vi.stubEnv('SLACK_CHANNEL_ID', 'C0123')
    expect(getSlackChannelId()).toBe('C0123')
  })

  it('returns undefined when whitespace only', () => {
    vi.stubEnv('SLACK_CHANNEL_ID', '  ')
    expect(getSlackChannelId()).toBeUndefined()
  })
})

describe('getTeamsWebhookUrl', () => {
  it('returns the configured webhook url', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://outlook.office.com/x')
    expect(getTeamsWebhookUrl()).toBe('https://outlook.office.com/x')
  })

  it('returns undefined when unset', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', '')
    expect(getTeamsWebhookUrl()).toBeUndefined()
  })
})

describe('getSlackApiBaseUrl', () => {
  it('defaults to the real Slack API when unset', () => {
    vi.stubEnv('SLACK_API_BASE_URL', '')
    expect(getSlackApiBaseUrl()).toBe('https://slack.com/api')
  })

  it('returns the override when configured', () => {
    vi.stubEnv('SLACK_API_BASE_URL', 'http://localhost:19999')
    expect(getSlackApiBaseUrl()).toBe('http://localhost:19999')
  })
})

describe('isSlackConfigured', () => {
  it('is true when both token and channel are set', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-abc')
    vi.stubEnv('SLACK_CHANNEL_ID', 'C0123')
    expect(isSlackConfigured()).toBe(true)
  })

  it('is false when the token is missing', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '')
    vi.stubEnv('SLACK_CHANNEL_ID', 'C0123')
    expect(isSlackConfigured()).toBe(false)
  })

  it('is false when the channel is missing', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-abc')
    vi.stubEnv('SLACK_CHANNEL_ID', '')
    expect(isSlackConfigured()).toBe(false)
  })
})
