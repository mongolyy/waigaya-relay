import { Redis } from '@upstash/redis'
import type { StoredMessage } from '@/lib/types'

const TTL_SECONDS = 60 * 60 * 24 * 14

// In-memory fallback for local dev / tests (no KV configured)
type MessageMeta = Omit<StoredMessage, 'reactions'>
const memMessages = new Map<string, MessageMeta>()
const memReactions = new Map<string, Record<string, number>>()
const memSessions = new Map<string, string[]>()

let redisInstance: Redis | null = null

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  redisInstance = new Redis({ url, token, retry: false })
  return redisInstance
}

export function clearStore(): void {
  memMessages.clear()
  memReactions.clear()
  memSessions.clear()
}

function memCreateMessage(sessionId: string, meta: MessageMeta): StoredMessage {
  memMessages.set(meta.id, meta)
  const ids = memSessions.get(sessionId) ?? []
  ids.push(meta.id)
  memSessions.set(sessionId, ids)
  return { ...meta, reactions: {} }
}

export async function createMessage(
  sessionId: string,
  id: string,
  text: string,
  username?: string,
): Promise<StoredMessage> {
  const meta: MessageMeta = {
    id,
    text,
    username,
    createdAt: new Date().toISOString(),
  }
  const redis = getRedis()

  if (!redis) {
    return memCreateMessage(sessionId, meta)
  }

  try {
    await redis.set(`message:${id}`, meta, { ex: TTL_SECONDS })
    await redis.rpush(`session_messages:${sessionId}`, id)
    await redis.expire(`session_messages:${sessionId}`, TTL_SECONDS)
    return { ...meta, reactions: {} }
  } catch (err) {
    console.error('Redis createMessage failed; falling back to memory.', err)
    return memCreateMessage(sessionId, meta)
  }
}

function memGetMessages(sessionId: string): StoredMessage[] {
  const ids = memSessions.get(sessionId) ?? []
  return ids.flatMap((id) => {
    const meta = memMessages.get(id)
    if (!meta) return []
    return [{ ...meta, reactions: { ...(memReactions.get(id) ?? {}) } }]
  })
}

export async function getMessages(sessionId: string): Promise<StoredMessage[]> {
  const redis = getRedis()

  if (!redis) {
    return memGetMessages(sessionId)
  }

  try {
    const ids = await redis.lrange<string>(
      `session_messages:${sessionId}`,
      0,
      -1,
    )
    if (ids.length === 0) return []

    const pipeline = redis.pipeline()
    for (const id of ids) {
      pipeline.get(`message:${id}`)
      pipeline.hgetall(`reactions:${id}`)
    }
    const results = await pipeline.exec()

    return ids.flatMap((_id, i) => {
      const meta = results[i * 2] as MessageMeta | null
      if (!meta) return []
      const raw = (results[i * 2 + 1] as Record<string, unknown> | null) ?? {}
      const reactions: Record<string, number> = {}
      for (const [k, v] of Object.entries(raw)) {
        const n = typeof v === 'number' ? v : parseInt(String(v), 10)
        if (n > 0) reactions[k] = n
      }
      return [{ ...meta, reactions }]
    })
  } catch (err) {
    console.error('Redis getMessages failed; falling back to memory.', err)
    return memGetMessages(sessionId)
  }
}

export async function addReaction(
  messageId: string,
  emoji: string,
): Promise<Record<string, number> | null> {
  const redis = getRedis()

  if (!redis) {
    if (!memMessages.has(messageId)) return null
    const reactions = memReactions.get(messageId) ?? {}
    reactions[emoji] = (reactions[emoji] ?? 0) + 1
    memReactions.set(messageId, reactions)
    return { ...reactions }
  }

  try {
    const exists = await redis.exists(`message:${messageId}`)
    if (!exists) return null
    await redis.hincrby(`reactions:${messageId}`, emoji, 1)
    await redis.expire(`reactions:${messageId}`, TTL_SECONDS)
    return await kvGetReactions(redis, messageId)
  } catch (err) {
    console.error('Redis addReaction failed; falling back to memory.', err)
    if (!memMessages.has(messageId)) return null
    const reactions = memReactions.get(messageId) ?? {}
    reactions[emoji] = (reactions[emoji] ?? 0) + 1
    memReactions.set(messageId, reactions)
    return { ...reactions }
  }
}

export async function removeReaction(
  messageId: string,
  emoji: string,
): Promise<Record<string, number> | null> {
  const redis = getRedis()

  if (!redis) {
    if (!memMessages.has(messageId)) return null
    const reactions = memReactions.get(messageId) ?? {}
    const current = reactions[emoji] ?? 0
    if (current <= 1) delete reactions[emoji]
    else reactions[emoji] = current - 1
    memReactions.set(messageId, reactions)
    return { ...reactions }
  }

  try {
    const exists = await redis.exists(`message:${messageId}`)
    if (!exists) return null
    const current = await redis.hget<number>(`reactions:${messageId}`, emoji)
    if ((current ?? 0) <= 1) {
      await redis.hdel(`reactions:${messageId}`, emoji)
    } else {
      await redis.hincrby(`reactions:${messageId}`, emoji, -1)
    }
    return await kvGetReactions(redis, messageId)
  } catch (err) {
    console.error('Redis removeReaction failed; falling back to memory.', err)
    if (!memMessages.has(messageId)) return null
    const reactions = memReactions.get(messageId) ?? {}
    const current = reactions[emoji] ?? 0
    if (current <= 1) delete reactions[emoji]
    else reactions[emoji] = current - 1
    memReactions.set(messageId, reactions)
    return { ...reactions }
  }
}

export async function getReactions(
  messageId: string,
): Promise<Record<string, number> | null> {
  const redis = getRedis()

  if (!redis) {
    if (!memMessages.has(messageId)) return null
    return { ...(memReactions.get(messageId) ?? {}) }
  }

  try {
    const exists = await redis.exists(`message:${messageId}`)
    if (!exists) return null
    return await kvGetReactions(redis, messageId)
  } catch (err) {
    console.error('Redis getReactions failed; falling back to memory.', err)
    if (!memMessages.has(messageId)) return null
    return { ...(memReactions.get(messageId) ?? {}) }
  }
}

async function kvGetReactions(
  redis: Redis,
  messageId: string,
): Promise<Record<string, number>> {
  const raw = await redis.hgetall<Record<string, number>>(
    `reactions:${messageId}`,
  )
  const reactions: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw ?? {})) {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (n > 0) reactions[k] = n
  }
  return reactions
}
