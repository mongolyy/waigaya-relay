import { beforeEach, describe, expect, it } from 'vitest'
import {
  addReaction,
  clearStore,
  createMessage,
  getMessages,
  getReactions,
  removeReaction,
} from '@/lib/store'

// These tests exercise the in-memory fallback (no Upstash env configured).
describe('store (in-memory)', () => {
  beforeEach(() => {
    clearStore()
  })

  describe('createMessage / getMessages', () => {
    it('returns an empty list for an unknown session', async () => {
      expect(await getMessages('unknown')).toEqual([])
    })

    it('stores a message and reads it back with empty reactions', async () => {
      const created = await createMessage('sess-1', 'msg-1', 'hello', 'Alice')
      expect(created).toEqual({
        id: 'msg-1',
        text: 'hello',
        username: 'Alice',
        createdAt: expect.any(String),
        reactions: {},
      })

      const messages = await getMessages('sess-1')
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        text: 'hello',
        username: 'Alice',
        reactions: {},
      })
    })

    it('allows the username to be omitted', async () => {
      const created = await createMessage('sess-1', 'msg-1', 'hi')
      expect(created.username).toBeUndefined()
    })

    it('preserves insertion order within a session', async () => {
      await createMessage('sess-1', 'msg-1', 'first')
      await createMessage('sess-1', 'msg-2', 'second')
      await createMessage('sess-1', 'msg-3', 'third')
      const ids = (await getMessages('sess-1')).map((m) => m.id)
      expect(ids).toEqual(['msg-1', 'msg-2', 'msg-3'])
    })

    it('keeps sessions isolated from one another', async () => {
      await createMessage('sess-1', 'msg-1', 'a')
      await createMessage('sess-2', 'msg-2', 'b')
      expect((await getMessages('sess-1')).map((m) => m.id)).toEqual(['msg-1'])
      expect((await getMessages('sess-2')).map((m) => m.id)).toEqual(['msg-2'])
    })
  })

  describe('addReaction', () => {
    it('returns null for an unknown message', async () => {
      expect(await addReaction('no-such-id', '👍')).toBeNull()
    })

    it('increments the count for an existing message', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      expect(await addReaction('msg-1', '👍')).toEqual({ '👍': 1 })
      expect(await addReaction('msg-1', '👍')).toEqual({ '👍': 2 })
    })

    it('tracks different emojis independently', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      await addReaction('msg-1', '👍')
      expect(await addReaction('msg-1', '❤️')).toEqual({ '👍': 1, '❤️': 1 })
    })
  })

  describe('removeReaction', () => {
    it('returns null for an unknown message', async () => {
      expect(await removeReaction('no-such-id', '👍')).toBeNull()
    })

    it('decrements a count above one', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      await addReaction('msg-1', '👍')
      await addReaction('msg-1', '👍')
      expect(await removeReaction('msg-1', '👍')).toEqual({ '👍': 1 })
    })

    it('removes the emoji key when the count reaches zero', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      await addReaction('msg-1', '👍')
      expect(await removeReaction('msg-1', '👍')).toEqual({})
    })

    it('is a no-op when removing an emoji that was never added', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      expect(await removeReaction('msg-1', '👍')).toEqual({})
    })
  })

  describe('getReactions', () => {
    it('returns null for an unknown message', async () => {
      expect(await getReactions('no-such-id')).toBeNull()
    })

    it('returns an empty object for a message with no reactions', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      expect(await getReactions('msg-1')).toEqual({})
    })

    it('returns the current reaction counts', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      await addReaction('msg-1', '👍')
      await addReaction('msg-1', '👍')
      await addReaction('msg-1', '🎉')
      expect(await getReactions('msg-1')).toEqual({ '👍': 2, '🎉': 1 })
    })

    it('reflects reactions when reading messages back', async () => {
      await createMessage('sess-1', 'msg-1', 'hello')
      await addReaction('msg-1', '👀')
      const messages = await getMessages('sess-1')
      expect(messages[0].reactions).toEqual({ '👀': 1 })
    })
  })
})
