/**
 * Maps a chat-log session to its per-platform thread anchors.
 *
 * Backed by Upstash Redis when `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` are set; otherwise an in-memory Map is used as a
 * fallback for local development and tests. The in-memory store does not
 * survive across serverless instances, so a durable KV is required in
 * production for threading to work reliably.
 */

import { Redis } from '@upstash/redis'

export interface SessionThread {
  /** Slack message timestamp (`ts`) of the session's thread-starting post. */
  slackThreadTs?: string
}

/** Time-to-live for session records, in seconds (14 days). */
const TTL_SECONDS = 60 * 60 * 24 * 14

const memory = new Map<string, SessionThread>()

function keyFor(sessionId: string): string {
  return `session:${sessionId}`
}

let redisInstance: Redis | null = null

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  redisInstance = new Redis({ url, token, retry: false })
  return redisInstance
}

/** Read the thread anchors for a session, or `null` when none exist yet. */
export async function getSessionThread(
  sessionId: string,
): Promise<SessionThread | null> {
  const redis = getRedis()
  if (!redis) {
    return memory.get(keyFor(sessionId)) ?? null
  }
  try {
    return await redis.get<SessionThread>(keyFor(sessionId))
  } catch (err) {
    console.error('Redis getSessionThread failed; falling back to memory.', err)
    return memory.get(keyFor(sessionId)) ?? null
  }
}

/** Persist the thread anchors for a session (with a TTL when using Redis). */
export async function saveSessionThread(
  sessionId: string,
  thread: SessionThread,
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    memory.set(keyFor(sessionId), thread)
    return
  }
  try {
    await redis.set(keyFor(sessionId), thread, { ex: TTL_SECONDS })
  } catch (err) {
    console.error(
      'Redis saveSessionThread failed; falling back to memory.',
      err,
    )
    memory.set(keyFor(sessionId), thread)
  }
}

/** Test helper: clears the in-memory fallback store. */
export function clearSessionStore(): void {
  memory.clear()
}
