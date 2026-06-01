import {
  addReaction as storeAddReaction,
  getReactions as storeGetReactions,
  removeReaction as storeRemoveReaction,
} from '@/lib/store'

const ALLOWED_EMOJIS = ['👍', '❤️', '😄', '🎉', '🤔', '👀']

export type ReactionResult =
  | { kind: 'validation_error'; error: string }
  | { kind: 'not_found'; error: string }
  | { kind: 'success'; reactions: Record<string, number> }

export async function getReactions(
  messageId: string | null,
): Promise<ReactionResult> {
  if (!messageId) {
    return { kind: 'validation_error', error: 'messageId is required.' }
  }
  const reactions = await storeGetReactions(messageId)
  if (reactions === null) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions }
}

function validateReaction(
  messageId: string | undefined,
  emoji: string | undefined,
): { messageId: string; emoji: string } | { error: string } {
  if (!messageId || !emoji) {
    return { error: 'messageId and emoji are required.' }
  }
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return { error: 'Invalid or unsupported emoji.' }
  }
  return { messageId, emoji }
}

export async function addReaction(
  messageId: string | undefined,
  emoji: string | undefined,
): Promise<ReactionResult> {
  const validation = validateReaction(messageId, emoji)
  if ('error' in validation) {
    return { kind: 'validation_error', error: validation.error }
  }
  const reactions = await storeAddReaction(
    validation.messageId,
    validation.emoji,
  )
  if (reactions === null) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions }
}

export async function removeReaction(
  messageId: string | undefined,
  emoji: string | undefined,
): Promise<ReactionResult> {
  const validation = validateReaction(messageId, emoji)
  if ('error' in validation) {
    return { kind: 'validation_error', error: validation.error }
  }
  const reactions = await storeRemoveReaction(
    validation.messageId,
    validation.emoji,
  )
  if (reactions === null) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions }
}
