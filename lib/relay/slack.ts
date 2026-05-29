import type { RelayResult } from "@/lib/types";

/** Timeout in ms to avoid hanging indefinitely when the webhook is unresponsive. */
const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Post a message to the Slack Incoming Webhook.
 * The posted message appears in the channel and serves as the thread starter.
 */
export async function postToSlack(
  webhookUrl: string | undefined,
  message: string,
): Promise<RelayResult> {
  if (!webhookUrl) {
    return {
      target: "slack",
      ok: false,
      skipped: true,
      detail: "SLACK_WEBHOOK_URL is not set — Slack relay skipped.",
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      const body = rawBody.length > 200 ? rawBody.substring(0, 200) + "..." : rawBody;
      return {
        target: "slack",
        ok: false,
        skipped: false,
        detail: `Slack post failed (HTTP ${res.status})${body ? `: ${body}` : ""}`,
      };
    }

    return { target: "slack", ok: true, skipped: false };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const errorMessage = err instanceof Error ? err.message : String(err);
    const detail = isTimeout
      ? `Slack post timed out (${WEBHOOK_TIMEOUT_MS}ms).`
      : `Slack post failed: ${errorMessage}`;
    return { target: "slack", ok: false, skipped: false, detail };
  }
}
