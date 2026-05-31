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

export function getReactions(messageId: string | null): ReactionResult {
  if (!messageId) {
    return { kind: 'validation_error', error: 'messageId is required.' }
  }
  const reactions = storeGetReactions(messageId)
  if (reactions === null) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions }
}

export function addReaction(
  messageId: string | undefined,
  emoji: string | undefined,
): ReactionResult {
  if (!messageId || !emoji) {
    return {
      kind: 'validation_error',
      error: 'messageId and emoji are required.',
    }
  }
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return { kind: 'validation_error', error: 'Invalid or unsupported emoji.' }
  }
  const msg = storeAddReaction(messageId, emoji)
  if (!msg) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions: msg.reactions }
}

export function removeReaction(
  messageId: string | undefined,
  emoji: string | undefined,
): ReactionResult {
  if (!messageId || !emoji) {
    return {
      kind: 'validation_error',
      error: 'messageId and emoji are required.',
    }
  }
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return { kind: 'validation_error', error: 'Invalid or unsupported emoji.' }
  }
  const msg = storeRemoveReaction(messageId, emoji)
  if (!msg) {
    return { kind: 'not_found', error: 'Message not found.' }
  }
  return { kind: 'success', reactions: msg.reactions }
}
