'use client'

import { useState } from 'react'
import type { PostMessageResponse, RelayResult, RelayTarget } from '@/lib/types'

const TARGET_LABEL: Record<RelayTarget, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; ok: boolean; allSkipped: boolean; results: RelayResult[] }

interface Props {
  configured: Record<RelayTarget, boolean>
}

export default function MessageComposer({ configured }: Props) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const sending = status.kind === 'sending'
  const unconfigured = (Object.keys(configured) as RelayTarget[]).filter(
    (t) => !configured[t],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || sending) return

    setStatus({ kind: 'sending' })

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      const data = (await res.json()) as
        | PostMessageResponse
        | { ok: false; error: string }

      if ('error' in data) {
        setStatus({ kind: 'error', message: data.error })
        return
      }

      const allSkipped = data.results.every((r) => r.skipped)
      setStatus({ kind: 'done', ok: data.ok, allSkipped, results: data.results })
      if (data.ok || allSkipped) setMessage('')
    } catch {
      setStatus({
        kind: 'error',
        message: 'Failed to send. Please check your network connection.',
      })
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>waigaya-relay 📣</h1>
        <p className="app__lead">
          Post a message and relay it to Slack and Microsoft Teams to spark a
          lively discussion.
        </p>
      </header>

      <details className="guide">
        <summary className="guide__summary">How to use</summary>
        <div className="guide__body">
          <ol className="guide__steps">
            <li>
              Enter a message and press <strong>Send</strong>
              <span className="guide__sub">
                メッセージを入力して <strong>Send</strong> を押す
              </span>
            </li>
            <li>
              The message is posted simultaneously to all configured
              destinations (Slack and Microsoft Teams)
              <span className="guide__sub">
                設定済みの送信先（Slack・Microsoft Teams）に同時に投稿される
              </span>
            </li>
            <li>
              Results are displayed at the bottom of the screen
              <span className="guide__sub">送信結果は画面下部に表示される</span>
            </li>
          </ol>
          <ul className="guide__notes">
            <li>
              Maximum 4,000 characters
              <span className="guide__sub">メッセージは最大 4,000 文字</span>
            </li>
            <li>
              Configure destinations via <code>SLACK_WEBHOOK_URL</code> /{' '}
              <code>TEAMS_WEBHOOK_URL</code> environment variables
              <span className="guide__sub">
                送信先は環境変数 <code>SLACK_WEBHOOK_URL</code> /{' '}
                <code>TEAMS_WEBHOOK_URL</code> で設定
              </span>
            </li>
            <li>
              Unconfigured destinations are shown as <em>skipped</em>
              <span className="guide__sub">
                未設定の送信先は <em>skipped</em> と表示される
              </span>
            </li>
          </ul>
        </div>
      </details>

      {unconfigured.length > 0 && (
        <div className="status__banner status__banner--warn" role="alert">
          ⚠️ {unconfigured.map((t) => TARGET_LABEL[t]).join(' and ')}{' '}
          {unconfigured.length === 1 ? 'is' : 'are'} not configured —{' '}
          {unconfigured.length === Object.keys(configured).length
            ? 'all relays will be skipped.'
            : 'that relay will be skipped.'}
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <label className="composer__label" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className="composer__input"
          rows={4}
          placeholder="Write something to get the conversation started…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="composer__submit"
          disabled={sending || message.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>

      <section className="status" aria-live="polite">
        {status.kind === 'error' && (
          <p className="status__banner status__banner--error">
            ⚠️ {status.message}
          </p>
        )}

        {status.kind === 'done' && (
          <>
            <p
              className={`status__banner ${
                status.ok
                  ? 'status__banner--ok'
                  : status.allSkipped
                    ? 'status__banner--warn'
                    : 'status__banner--error'
              }`}
            >
              {status.ok
                ? '✅ Relayed! Start a thread and get the discussion going.'
                : status.allSkipped
                  ? '⚠️ No relay targets configured — message was not sent.'
                  : '⚠️ Relay failed. See details below.'}
            </p>
            <ul className="status__list">
              {status.results.map((r) => (
                <li key={r.target} className="status__item">
                  <span
                    className={`status__dot ${
                      r.skipped
                        ? 'status__dot--skip'
                        : r.ok
                          ? 'status__dot--ok'
                          : 'status__dot--error'
                    }`}
                  />
                  <span className="status__target">
                    {TARGET_LABEL[r.target]}
                  </span>
                  <span className="status__detail">
                    {r.skipped ? 'skipped (not configured)' : r.ok ? 'success' : 'failed'}
                    {r.detail && !r.skipped ? ` — ${r.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}
