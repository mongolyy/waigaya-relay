/**
 * Maps a chat-log session to its per-platform thread anchors.
 *
 * Backed by Upstash Redis (REST API) when `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` are set; otherwise an in-memory Map is used as a
 * fallback for local development and tests. The in-memory store does not
 * survive across serverless instances, so a durable KV is required in
 * production for threading to work reliably.
 */

export interface SessionThread {
  /** Slack message timestamp (`ts`) of the session's thread-starting post. */
  slackThreadTs?: string
}

/** Time-to-live for session records, in seconds (14 days). */
const TTL_SECONDS = 60 * 60 * 24 * 14

/** Timeout in ms for the Upstash REST request. */
const KV_TIMEOUT_MS = 5000

const memory = new Map<string, SessionThread>()

function keyFor(sessionId: string): string {
  return `session:${sessionId}`
}

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  return url && token ? { url, token } : null
}

async function upstashCommand(
  config: { url: string; token: string },
  command: (string | number)[],
): Promise<unknown> {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(KV_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Upstash command failed (HTTP ${res.status})`)
  }
  const data = (await res.json()) as { result?: unknown; error?: string }
  if (data.error) throw new Error(`Upstash error: ${data.error}`)
  return data.result
}

/** Read the thread anchors for a session, or `null` when none exist yet. */
export async function getSessionThread(
  sessionId: string,
): Promise<SessionThread | null> {
  const config = upstashConfig()
  if (!config) {
    return memory.get(keyFor(sessionId)) ?? null
  }
  try {
    const result = await upstashCommand(config, ['GET', keyFor(sessionId)])
    if (typeof result !== 'string') return null
    return JSON.parse(result) as SessionThread
  } catch (err) {
    // A Redis outage must not break the relay; degrade to the in-memory store.
    console.error(
      'Upstash getSessionThread failed; falling back to memory.',
      err,
    )
    return memory.get(keyFor(sessionId)) ?? null
  }
}

/** Persist the thread anchors for a session (with a TTL when using Upstash). */
export async function saveSessionThread(
  sessionId: string,
  thread: SessionThread,
): Promise<void> {
  const config = upstashConfig()
  if (!config) {
    memory.set(keyFor(sessionId), thread)
    return
  }
  try {
    await upstashCommand(config, [
      'SET',
      keyFor(sessionId),
      JSON.stringify(thread),
      'EX',
      TTL_SECONDS,
    ])
  } catch (err) {
    // A Redis outage must not break the relay; degrade to the in-memory store.
    console.error(
      'Upstash saveSessionThread failed; falling back to memory.',
      err,
    )
    memory.set(keyFor(sessionId), thread)
  }
}

/** Test helper: clears the in-memory fallback store. */
export function clearSessionStore(): void {
  memory.clear()
}
