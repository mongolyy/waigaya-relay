export interface StoredMessage {
  id: string
  text: string
  reactions: Record<string, number>
  // Future Approach B: add slackTs and teamsMessageId here
}

const messages = new Map<string, StoredMessage>()

export function createMessage(id: string, text: string): StoredMessage {
  const msg: StoredMessage = { id, text, reactions: {} }
  messages.set(id, msg)
  return msg
}

export function addReaction(
  messageId: string,
  emoji: string,
): StoredMessage | null {
  const msg = messages.get(messageId)
  if (!msg) return null
  msg.reactions[emoji] = (msg.reactions[emoji] ?? 0) + 1
  return msg
}

export function getReactions(
  messageId: string,
): Record<string, number> | null {
  const msg = messages.get(messageId)
  return msg ? msg.reactions : null
}
