import { NextResponse } from "next/server";
import { getSlackWebhookUrl, getTeamsWebhookUrl } from "@/lib/config";
import { postToSlack } from "@/lib/relay/slack";
import { postToTeams } from "@/lib/relay/teams";
import type { PostMessageResponse, RelayResult } from "@/lib/types";

const MAX_MESSAGE_LENGTH = 4000;

// Webhook への外部 fetch を行うため Node.js ランタイムで実行する。
export const runtime = "nodejs";

/** メッセージを Slack / Teams に中継する。 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const rawMessage =
    typeof (body as { message?: unknown })?.message === "string"
      ? (body as { message: string }).message
      : "";
  const message = rawMessage.trim();

  if (!message) {
    return NextResponse.json(
      { ok: false, error: "メッセージを入力してください。" },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `メッセージが長すぎます（最大 ${MAX_MESSAGE_LENGTH} 文字）。` },
      { status: 400 },
    );
  }

  // Slack と Teams は独立に投稿し、片方の失敗がもう片方に影響しないようにする。
  const results: RelayResult[] = await Promise.all([
    postToSlack(getSlackWebhookUrl(), message),
    postToTeams(getTeamsWebhookUrl(), message),
  ]);

  // 「実行された（スキップでない）」中継がすべて成功したかどうか。
  const executed = results.filter((r) => !r.skipped);
  const ok = executed.length > 0 && executed.every((r) => r.ok);

  const response: PostMessageResponse = { ok, results };
  // 中継の成否はレスポンスボディの ok / results で伝える。
  // 常に 200 を返すことで、Vercel 等の CDN が 5xx を HTML エラーページに
  // 差し替えてフロントエンドの JSON パースが壊れる問題を防ぐ。
  return NextResponse.json(response, { status: 200 });
}
