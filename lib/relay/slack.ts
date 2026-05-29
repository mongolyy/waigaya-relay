import type { RelayResult } from "@/lib/types";

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
    return {
      target: "slack",
      ok: false,
      skipped: false,
      detail: `Slack への投稿中にエラーが発生しました: ${(err as Error).message}`,
    };
  }
}
