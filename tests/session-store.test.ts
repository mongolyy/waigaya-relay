import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
