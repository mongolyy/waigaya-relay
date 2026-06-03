/** Relay destination identifier. Extend from this type when adding channels. */
export type RelayTarget = 'slack' | 'teams'

/** A message stored in the backend. */
export interface StoredMessage {
  id: string
  text: string
  username?: string
  createdAt: string
  reactions: Record<string, number>
}

/** Response for GET /api/messages. */
export interface GetMessagesResponse {
  messages: StoredMessage[]
}

/** Message-send request received from the frontend. */
export interface PostMessageRequest {
  /** Message body. */
  message: string
  /** Author name (optional). Prepended to the relayed message. */
  username?: string
  /**
   * Client-generated session identifier. Every message in a single chat log
   * shares the same id so they land in the same thread. Optional: when absent,
   * the message is posted as a new top-level message without threading.
   */
  sessionId?: string
}

/** Result of relaying to a single destination. */
export interface RelayResult {
  target: RelayTarget
  /** Whether the post succeeded. */
  ok: boolean
  /** True when the relay was skipped (e.g. not configured). */
  skipped: boolean
  /** Human-facing message for failures or skips. */
  detail?: string
  /**
   * For Slack: the message timestamp (`ts`) of the posted message, used as the
   * thread anchor for subsequent posts in the same session.
   */
  ts?: string
  /**
   * For Teams: the Bot Connector conversation id of the posted message, used
   * as the thread anchor for subsequent posts in the same session.
   */
  conversationId?: string
}

/** Overall API response. */
export interface PostMessageResponse {
  /** True only when every "executed" relay succeeded. */
  ok: boolean
  results: RelayResult[]
  /** Identifier of the posted message. Used by the reactions API. */
  messageId: string
}

export interface AddReactionRequest {
  messageId: string
  emoji: string
}

export interface ReactionsResponse {
  reactions: Record<string, number>
}
