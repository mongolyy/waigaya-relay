import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COOLDOWN_DAYS,
  getSlackWebhookConfig,
  getTeamsWebhookConfig,
} from '@/lib/config'

const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000

describe('getSlackWebhookConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns url:undefined and inCooldown:false when env var is not set', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '')
    expect(getSlackWebhookConfig()).toEqual({
      url: undefined,
      inCooldown: false,
    })
  })

  it('returns the URL with inCooldown:false when REGISTERED_AT is not set', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
    vi.stubEnv('SLACK_WEBHOOK_REGISTERED_AT', '')
    expect(getSlackWebhookConfig()).toEqual({
      url: 'https://hooks.slack.com/test',
      inCooldown: false,
    })
  })

  it('returns inCooldown:true when REGISTERED_AT is within the cooldown window', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    vi.stubEnv('SLACK_WEBHOOK_REGISTERED_AT', oneHourAgo)
    expect(getSlackWebhookConfig().inCooldown).toBe(true)
  })

  it('returns inCooldown:false when REGISTERED_AT is older than the cooldown window', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
    const fourDaysAgo = new Date(
      Date.now() - COOLDOWN_MS - 60 * 1000,
    ).toISOString()
    vi.stubEnv('SLACK_WEBHOOK_REGISTERED_AT', fourDaysAgo)
    expect(getSlackWebhookConfig().inCooldown).toBe(false)
  })

  it('returns inCooldown:true when REGISTERED_AT is exactly now', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
    vi.stubEnv('SLACK_WEBHOOK_REGISTERED_AT', new Date().toISOString())
    expect(getSlackWebhookConfig().inCooldown).toBe(true)
  })

  it('returns inCooldown:false when REGISTERED_AT is an invalid date string', () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/test')
    vi.stubEnv('SLACK_WEBHOOK_REGISTERED_AT', 'not-a-date')
    expect(getSlackWebhookConfig().inCooldown).toBe(false)
  })
})

describe('getTeamsWebhookConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns url:undefined and inCooldown:false when env var is not set', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', '')
    expect(getTeamsWebhookConfig()).toEqual({
      url: undefined,
      inCooldown: false,
    })
  })

  it('returns inCooldown:true when REGISTERED_AT is within the cooldown window', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://outlook.office.com/test')
    const twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000,
    ).toISOString()
    vi.stubEnv('TEAMS_WEBHOOK_REGISTERED_AT', twoDaysAgo)
    expect(getTeamsWebhookConfig().inCooldown).toBe(true)
  })

  it('returns inCooldown:false when REGISTERED_AT is older than the cooldown window', () => {
    vi.stubEnv('TEAMS_WEBHOOK_URL', 'https://outlook.office.com/test')
    const fourDaysAgo = new Date(
      Date.now() - COOLDOWN_MS - 60 * 1000,
    ).toISOString()
    vi.stubEnv('TEAMS_WEBHOOK_REGISTERED_AT', fourDaysAgo)
    expect(getTeamsWebhookConfig().inCooldown).toBe(false)
  })
})
