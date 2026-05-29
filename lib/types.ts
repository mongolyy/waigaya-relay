/** Relay target identifier. Extend this type first when adding channel selection. */
export type RelayTarget = "slack" | "teams";

/** Message send request received from the frontend. */
export interface PostMessageRequest {
  /** Message body to post. */
  message: string;
}

/** Post result for a single relay target. */
export interface RelayResult {
  target: RelayTarget;
  /** Whether the post succeeded. */
  ok: boolean;
  /** True when relay was skipped, for example because configuration is missing. */
  skipped: boolean;
  /** Human-readable message for failures and skipped relays. */
  detail?: string;
}

/** Full API response. */
export interface PostMessageResponse {
  /** Whether every executed relay succeeded. */
  ok: boolean;
  results: RelayResult[];
}
