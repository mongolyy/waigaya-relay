import type { RelayResult } from "@/lib/types";

/**
 * Microsoft Teams の Incoming Webhook にメッセージを投稿する。
 * MessageCard 形式の JSON を送信する。投稿されたメッセージに
 * 返信することで Teams 側でスレッドが始まる。
 */
export async function postToTeams(
  webhookUrl: string | undefined,
  message: string,
): Promise<RelayResult> {
  if (!webhookUrl) {
    return {
      target: "teams",
      ok: false,
      skipped: true,
      detail: "TEAMS_WEBHOOK_URL が未設定のため Teams への中継をスキップしました。",
    };
  }

  const payload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: "waigaya-relay",
    text: message,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        target: "teams",
        ok: false,
        skipped: false,
        detail: `Teams への投稿に失敗しました (HTTP ${res.status})${body ? `: ${body}` : ""}`,
      };
    }

    return { target: "teams", ok: true, skipped: false };
  } catch (err) {
    return {
      target: "teams",
      ok: false,
      skipped: false,
      detail: `Teams への投稿中にエラーが発生しました: ${(err as Error).message}`,
    };
  }
}
