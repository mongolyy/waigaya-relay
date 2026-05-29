"use client";

import { useState } from "react";
import type { PostMessageResponse, RelayResult } from "@/lib/types";

const TARGET_LABEL: Record<RelayResult["target"], string> = {
  slack: "Slack",
  teams: "Microsoft Teams",
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string }
  | { kind: "done"; ok: boolean; results: RelayResult[] };

export default function Home() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const sending = status.kind === "sending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = (await res.json()) as
        | PostMessageResponse
        | { ok: false; error: string };

      if ("error" in data) {
        setStatus({ kind: "error", message: data.error });
        return;
      }

      setStatus({ kind: "done", ok: data.ok, results: data.results });
      if (data.ok) setMessage("");
    } catch {
      setStatus({
        kind: "error",
        message: "送信に失敗しました。ネットワークを確認してください。",
      });
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>waigaya-relay 📣</h1>
        <p className="app__lead">
          投稿すると Slack と Microsoft Teams に中継して、ワイワイガヤガヤの起点を作ります。
        </p>
      </header>

      <form className="composer" onSubmit={handleSubmit}>
        <label className="composer__label" htmlFor="message">
          メッセージ
        </label>
        <textarea
          id="message"
          className="composer__input"
          rows={4}
          placeholder="議論のきっかけを書いてみよう…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="composer__submit"
          disabled={sending || message.trim().length === 0}
        >
          {sending ? "送信中…" : "送信する"}
        </button>
      </form>

      <section className="status" aria-live="polite">
        {status.kind === "error" && (
          <p className="status__banner status__banner--error">⚠️ {status.message}</p>
        )}

        {status.kind === "done" && (
          <>
            <p
              className={`status__banner ${
                status.ok ? "status__banner--ok" : "status__banner--error"
              }`}
            >
              {status.ok
                ? "✅ 中継しました。スレッドを立てて議論を始めましょう！"
                : status.results.every((r) => r.skipped)
                  ? "⚠️ 中継先が設定されていません。環境変数を確認してください。"
                  : "⚠️ 中継に失敗しました。詳細を確認してください。"}
            </p>
            <ul className="status__list">
              {status.results.map((r) => (
                <li key={r.target} className="status__item">
                  <span
                    className={`status__dot ${
                      r.skipped
                        ? "status__dot--skip"
                        : r.ok
                          ? "status__dot--ok"
                          : "status__dot--error"
                    }`}
                  />
                  <span className="status__target">{TARGET_LABEL[r.target]}</span>
                  <span className="status__detail">
                    {r.skipped ? "スキップ" : r.ok ? "成功" : "失敗"}
                    {r.detail ? `（${r.detail}）` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
