import type { RelayResult } from "@/lib/types";

/** Webhook が無応答の場合に待ち続けないためのタイムアウト（ミリ秒）。 */
const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Slack の Incoming Webhook にメッセージを投稿する。
 * 投稿されたメッセージはチャンネルに表示され、そのまま「スレッドの起点」となる。
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
      detail: "SLACK_WEBHOOK_URL が未設定のため Slack への中継をスキップしました。",
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
      const body = await res.text().catch(() => "");
      return {
        target: "slack",
        ok: false,
        skipped: false,
        detail: `Slack への投稿に失敗しました (HTTP ${res.status})${body ? `: ${body}` : ""}`,
      };
    }

    return { target: "slack", ok: true, skipped: false };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const errorMessage = err instanceof Error ? err.message : String(err);
    const detail = isTimeout
      ? `Slack への投稿がタイムアウトしました（${WEBHOOK_TIMEOUT_MS}ms）。`
      : `Slack への投稿中にエラーが発生しました: ${errorMessage}`;
    return { target: "slack", ok: false, skipped: false, detail };
  }
}
