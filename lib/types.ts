/** 中継先の識別子。将来チャンネル選択を追加する際もこの型を起点に拡張する。 */
export type RelayTarget = 'slack' | 'teams'

/** フロントエンドから受け取るメッセージ送信リクエスト。 */
export interface PostMessageRequest {
  /** 投稿本文。 */
  message: string
  /** 投稿者名（省略可）。 */
  username?: string
}

/** 1 つの中継先に対する投稿結果。 */
export interface RelayResult {
  target: RelayTarget
  /** 投稿が成功したか。 */
  ok: boolean
  /** 設定が無いなどで中継をスキップした場合 true。 */
  skipped: boolean
  /** 失敗・スキップ時の人間向けメッセージ。 */
  detail?: string
}

/** API のレスポンス全体。 */
export interface PostMessageResponse {
  /** すべての「実行された」中継が成功したか。 */
  ok: boolean
  results: RelayResult[]
  /** 投稿されたメッセージの識別子。リアクション API で使用する。 */
  messageId: string
}

export interface AddReactionRequest {
  messageId: string
  emoji: string
}

export interface ReactionsResponse {
  reactions: Record<string, number>
}
