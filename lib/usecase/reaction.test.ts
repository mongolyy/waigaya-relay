import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/store', () => ({
  addReaction: vi.fn(),
  getReactions: vi.fn(),
  removeReaction: vi.fn(),
}))

import {
  addReaction as storeAddReaction,
  getReactions as storeGetReactions,
  removeReaction as storeRemoveReaction,
} from '@/lib/store'
import {
  addReaction,
  getReactions,
  removeReaction,
} from '@/lib/usecase/reaction'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReactions', () => {
  it('rejects a missing messageId', async () => {
    const result = await getReactions(null)
    expect(result).toEqual({
      kind: 'validation_error',
      error: 'messageId is required.',
    })
    expect(storeGetReactions).not.toHaveBeenCalled()
  })

  it('reports not_found when the store returns null', async () => {
    vi.mocked(storeGetReactions).mockResolvedValueOnce(null)
    const result = await getReactions('msg-1')
    expect(result).toEqual({ kind: 'not_found', error: 'Message not found.' })
  })

  it('returns the reactions on success', async () => {
    vi.mocked(storeGetReactions).mockResolvedValueOnce({ '👍': 2 })
    const result = await getReactions('msg-1')
    expect(result).toEqual({ kind: 'success', reactions: { '👍': 2 } })
  })
})

describe.each([
  ['addReaction', addReaction, storeAddReaction] as const,
  ['removeReaction', removeReaction, storeRemoveReaction] as const,
])('%s', (_name, usecaseFn, storeFn) => {
  it('rejects when messageId is missing', async () => {
    const result = await usecaseFn(undefined, '👍')
    expect(result).toEqual({
      kind: 'validation_error',
      error: 'messageId and emoji are required.',
    })
    expect(storeFn).not.toHaveBeenCalled()
  })

  it('rejects when emoji is missing', async () => {
    const result = await usecaseFn('msg-1', undefined)
    expect(result.kind).toBe('validation_error')
    expect(storeFn).not.toHaveBeenCalled()
  })

  it('rejects an unsupported emoji', async () => {
    const result = await usecaseFn('msg-1', '🦄')
    expect(result).toEqual({
      kind: 'validation_error',
      error: 'Invalid or unsupported emoji.',
    })
    expect(storeFn).not.toHaveBeenCalled()
  })

  it('reports not_found when the store returns null', async () => {
    vi.mocked(storeFn).mockResolvedValueOnce(null)
    const result = await usecaseFn('msg-1', '👍')
    expect(result).toEqual({ kind: 'not_found', error: 'Message not found.' })
  })

  it('returns the updated reactions on success', async () => {
    vi.mocked(storeFn).mockResolvedValueOnce({ '👍': 1 })
    const result = await usecaseFn('msg-1', '👍')
    expect(result).toEqual({ kind: 'success', reactions: { '👍': 1 } })
    expect(storeFn).toHaveBeenCalledWith('msg-1', '👍')
  })
})
