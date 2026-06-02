import { randomUUID } from 'node:crypto'
import {
  getSlackBotToken,
  getSlackChannelId,
  getTeamsBotAppId,
  getTeamsBotAppPassword,
  getTeamsBotTenantId,
  getTeamsChannelId,
} from '@/lib/config'
import { postToSlack } from '@/lib/relay/slack'
import { postToTeams } from '@/lib/relay/teams'
import { getSessionThread, saveSessionThread } from '@/lib/session-store'
import { createMessage } from '@/lib/store'
import type { PostMessageResponse, RelayResult } from '@/lib/types'

const MAX_MESSAGE_LENGTH = 4000
const MAX_USERNAME_LENGTH = 80
const SESSION_ID_PATTERN = /^[a-z0-9]{12}$/

export type RelayMessageInput = {
  message: unknown
  username?: unknown
  sessionId?: unknown
}

export type RelayMessageResult =
  | { kind: 'validation_error'; error: string }
  | { kind: 'success'; response: PostMessageResponse }

export async function relayMessage(
  input: RelayMessageInput,
): Promise<RelayMessageResult> {
  const rawMessage = typeof input.message === 'string' ? input.message : ''
  const message = rawMessage.trim()

  if (!message) {
    return { kind: 'validation_error', error: 'Message must not be empty.' }
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      kind: 'validation_error',
      error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    }
  }

  const username =
    typeof input.username === 'string'
      ? input.username.trim() || undefined
      : undefined

  if (username && username.length > MAX_USERNAME_LENGTH) {
    return {
      kind: 'validation_error',
      error: `Username is too long (max ${MAX_USERNAME_LENGTH} characters).`,
    }
  }

  const rawSessionId =
    typeof input.sessionId === 'string' ? input.sessionId.trim() : ''
  if (rawSessionId && !SESSION_ID_PATTERN.test(rawSessionId)) {
    return { kind: 'validation_error', error: 'Invalid sessionId format.' }
  }
  const sessionId = rawSessionId

  const messageId = randomUUID()
  await createMessage(sessionId || 'default', messageId, message, username)

  const session = sessionId ? await getSessionThread(sessionId) : null
  const slackThreadTs = session?.slackThreadTs
  const teamsThreadId = session?.teamsThreadId

  const results: RelayResult[] = await Promise.all([
    postToSlack(
      { token: getSlackBotToken(), channel: getSlackChannelId() },
      message,
      { threadTs: slackThreadTs, username },
    ),
    postToTeams(
      {
        appId: getTeamsBotAppId(),
        appPassword: getTeamsBotAppPassword(),
        tenantId: getTeamsBotTenantId(),
        channelId: getTeamsChannelId(),
      },
      message,
      { conversationId: teamsThreadId, username },
    ),
  ])

  if (sessionId) {
    const slack = results.find((r) => r.target === 'slack')
    const teams = results.find((r) => r.target === 'teams')
    const newSlackTs = slackThreadTs ?? (slack?.ok ? slack.ts : undefined)
    const newTeamsId =
      teamsThreadId ?? (teams?.ok ? teams.conversationId : undefined)
    const slackIsNew = !slackThreadTs && !!newSlackTs
    const teamsIsNew = !teamsThreadId && !!newTeamsId
    if (slackIsNew || teamsIsNew) {
      await saveSessionThread(sessionId, {
        ...(newSlackTs ? { slackThreadTs: newSlackTs } : {}),
        ...(newTeamsId ? { teamsThreadId: newTeamsId } : {}),
      })
    }
  }

  const executed = results.filter((r) => !r.skipped)
  const ok = executed.length > 0 && executed.every((r) => r.ok)

  return { kind: 'success', response: { ok, results, messageId } }
}
