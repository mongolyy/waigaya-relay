import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSessionStore,
  getSessionThread,
  saveSessionThread,
} from '@/lib/session-store'

// These tests exercise the in-memory fallback (no Upstash env configured).
describe('session-store (in-memory fallback)', () => {
  beforeEach(() => {
    clearSessionStore()
  })

  afterEach(() => {
    clearSessionStore()
  })

  it('returns null for an unknown session', async () => {
    expect(await getSessionThread('unknown')).toBeNull()
  })

  it('persists and reads back a thread anchor', async () => {
    await saveSessionThread('sess-1', { slackThreadTs: '1.1' })
    expect(await getSessionThread('sess-1')).toEqual({ slackThreadTs: '1.1' })
  })

  it('keeps sessions isolated from one another', async () => {
    await saveSessionThread('sess-1', { slackThreadTs: '1.1' })
    await saveSessionThread('sess-2', { slackThreadTs: '2.2' })
    expect(await getSessionThread('sess-1')).toEqual({ slackThreadTs: '1.1' })
    expect(await getSessionThread('sess-2')).toEqual({ slackThreadTs: '2.2' })
  })

  it('clearSessionStore empties the store', async () => {
    await saveSessionThread('sess-1', { slackThreadTs: '1.1' })
    clearSessionStore()
    expect(await getSessionThread('sess-1')).toBeNull()
  })
})

// When Upstash is configured but unreachable, the store must not throw — it
// degrades to the in-memory fallback so the relay keeps working.
describe('session-store (Upstash failure fallback)', () => {
  beforeEach(() => {
    clearSessionStore()
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('redis down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    clearSessionStore()
  })

  it('does not throw and returns null on a failed read', async () => {
    expect(await getSessionThread('sess-x')).toBeNull()
  })

  it('falls back to memory so a write can be read back', async () => {
    await saveSessionThread('sess-x', { slackThreadTs: '9.9' })
    expect(await getSessionThread('sess-x')).toEqual({ slackThreadTs: '9.9' })
  })
})
