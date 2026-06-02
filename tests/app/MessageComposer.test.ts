import { describe, expect, it } from 'vitest'
import { relayStatusTooltip } from '@/app/MessageComposer'
import type { RelayResult } from '@/lib/types'

describe('relayStatusTooltip', () => {
  it('returns "skipped (not configured)" when skipped', () => {
    const result: RelayResult = { target: 'slack', ok: false, skipped: true }
    expect(relayStatusTooltip(result)).toBe('skipped (not configured)')
  })

  it('returns "success" when ok', () => {
    const result: RelayResult = {
      target: 'slack',
      ok: true,
      skipped: false,
      ts: '1700000000.000100',
    }
    expect(relayStatusTooltip(result)).toBe('success')
  })

  it('returns "failed" when not ok and no detail', () => {
    const result: RelayResult = { target: 'teams', ok: false, skipped: false }
    expect(relayStatusTooltip(result)).toBe('failed')
  })

  it('appends detail when failed with a detail message', () => {
    const result: RelayResult = {
      target: 'slack',
      ok: false,
      skipped: false,
      detail: 'channel_not_found',
    }
    expect(relayStatusTooltip(result)).toBe('failed — channel_not_found')
  })
})
