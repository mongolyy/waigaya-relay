import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSlackApiBaseUrl,
  getSlackBotToken,
  getSlackChannelId,
  getTeamsBotAppId,
  getTeamsBotLoginUrl,
  getTeamsBotServiceUrl,
  getTeamsChannelId,
  getTeamsWebhookUrl,
  isSlackConfigured,
  isTeamsConfigured,
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

describe('getTeamsBotAppId', () => {
  it('returns the configured app id', () => {
    vi.stubEnv('TEAMS_BOT_APP_ID', 'app-123')
    expect(getTeamsBotAppId()).toBe('app-123')
  })

  it('returns undefined when unset', () => {
    vi.stubEnv('TEAMS_BOT_APP_ID', '')
    expect(getTeamsBotAppId()).toBeUndefined()
  })
})

describe('getTeamsChannelId', () => {
  it('returns the configured channel id', () => {
    vi.stubEnv('TEAMS_CHANNEL_ID', '19:abc@thread.tacv2')
    expect(getTeamsChannelId()).toBe('19:abc@thread.tacv2')
  })

  it('returns undefined when unset', () => {
    vi.stubEnv('TEAMS_CHANNEL_ID', '')
    expect(getTeamsChannelId()).toBeUndefined()
  })
})

describe('getTeamsBotServiceUrl', () => {
  it('defaults to the Teams Bot Framework service URL', () => {
    vi.stubEnv('TEAMS_BOT_SERVICE_URL', '')
    expect(getTeamsBotServiceUrl()).toBe(
      'https://smba.trafficmanager.net/teams',
    )
  })

  it('returns the override when configured', () => {
    vi.stubEnv('TEAMS_BOT_SERVICE_URL', 'http://localhost:19999/teams-service')
    expect(getTeamsBotServiceUrl()).toBe('http://localhost:19999/teams-service')
  })
})

describe('getTeamsBotLoginUrl', () => {
  it('defaults to the Microsoft login endpoint', () => {
    vi.stubEnv('TEAMS_BOT_LOGIN_URL', '')
    expect(getTeamsBotLoginUrl()).toBe('https://login.microsoftonline.com')
  })

  it('returns the override when configured', () => {
    vi.stubEnv('TEAMS_BOT_LOGIN_URL', 'http://localhost:19999/teams-login')
    expect(getTeamsBotLoginUrl()).toBe('http://localhost:19999/teams-login')
  })
})

describe('getTeamsWebhookUrl', () => {
  it('returns the configured webhook URL', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://example.webhook.office.com/xyz')
    expect(getTeamsWebhookUrl()).toBe('https://example.webhook.office.com/xyz')
  })

  it('returns undefined when unset', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', '')
    expect(getTeamsWebhookUrl()).toBeUndefined()
  })
})

describe('isTeamsConfigured', () => {
  it('is true when all Bot fields are set', () => {
    vi.stubEnv('TEAMS_BOT_APP_ID', 'app-id')
    vi.stubEnv('TEAMS_BOT_APP_PASSWORD', 'password')
    vi.stubEnv('TEAMS_BOT_TENANT_ID', 'tenant-id')
    vi.stubEnv('TEAMS_CHANNEL_ID', '19:abc@thread.tacv2')
    expect(isTeamsConfigured()).toBe(true)
  })

  it('is true when only the webhook URL is set', () => {
    vi.stubEnv('TEAMS_BOT_APP_ID', '')
    vi.stubEnv('TEAMS_BOT_APP_PASSWORD', '')
    vi.stubEnv('TEAMS_BOT_TENANT_ID', '')
    vi.stubEnv('TEAMS_CHANNEL_ID', '')
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://example.webhook.office.com/xyz')
    expect(isTeamsConfigured()).toBe(true)
  })

  it('is false when neither Bot fields nor webhook URL are set', () => {
    vi.stubEnv('TEAMS_BOT_APP_ID', '')
    vi.stubEnv('TEAMS_BOT_APP_PASSWORD', 'password')
    vi.stubEnv('TEAMS_BOT_TENANT_ID', 'tenant-id')
    vi.stubEnv('TEAMS_CHANNEL_ID', '19:abc@thread.tacv2')
    vi.stubEnv('TEAMS_WEBHOOK_URL', '')
    expect(isTeamsConfigured()).toBe(false)
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
