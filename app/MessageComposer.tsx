'use client'

import { useState } from 'react'
import type {
  PostMessageResponse,
  ReactionsResponse,
  RelayResult,
  RelayTarget,
} from '@/lib/types'

const TARGET_LABEL: Record<RelayTarget, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
}

const PRESET_EMOJIS = ['👍', '❤️', '😄', '🎉', '🤔', '👀']

/** sessionStorage key holding the current chat-log session id. */
const SESSION_KEY = 'waigaya-relay:sessionId'

/**
 * Return the current session id, generating and persisting one on first use.
 * All messages sent with the same id are grouped into a single thread.
 */
function getSessionId(): string {
  let id = window.sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/** Start a fresh session so subsequent messages open a new thread. */
function resetSessionId(): void {
  window.sessionStorage.setItem(SESSION_KEY, crypto.randomUUID())
}

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }

type PostedMessage = {
  id: string
  text: string
  reactions: Record<string, number>
  userReacted: Set<string>
  ok: boolean
  allSkipped: boolean
  results: RelayResult[]
}

interface Props {
  configured: Record<RelayTarget, boolean>
}

export default function MessageComposer({ configured }: Props) {
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState<FormStatus>({ kind: 'idle' })
  const [postedMessages, setPostedMessages] = useState<PostedMessage[]>([])

  const sending = formStatus.kind === 'sending'
  const unconfigured = (Object.keys(configured) as RelayTarget[]).filter(
    (t) => !configured[t],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || sending) return

    setFormStatus({ kind: 'sending' })

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId: getSessionId() }),
      })

      const data = (await res.json()) as
        | PostMessageResponse
        | { ok: false; error: string }

      if (data && 'error' in data) {
        setFormStatus({ kind: 'error', message: data.error })
        return
      }

      if (!data || !('results' in data) || !Array.isArray(data.results)) {
        setFormStatus({
          kind: 'error',
          message: 'Received an invalid response from the server.',
        })
        return
      }

      const allSkipped = data.results.every((r) => r.skipped)
      setPostedMessages((prev) => [
        {
          id: data.messageId,
          text: trimmed,
          reactions: {},
          userReacted: new Set(),
          ok: data.ok,
          allSkipped,
          results: data.results,
        },
        ...prev,
      ])
      setFormStatus({ kind: 'idle' })
      if (data.ok || allSkipped) setMessage('')
    } catch {
      setFormStatus({
        kind: 'error',
        message: 'Failed to send. Please check your network connection.',
      })
    }
  }

  function handleNewThread() {
    resetSessionId()
    setPostedMessages([])
    setFormStatus({ kind: 'idle' })
  }

  async function handleReaction(messageId: string, emoji: string) {
    const msg = postedMessages.find((m) => m.id === messageId)
    const alreadyReacted = msg?.userReacted.has(emoji) ?? false

    try {
      const res = await fetch('/api/reactions', {
        method: alreadyReacted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      })
      if (!res.ok) return
      const data = (await res.json()) as ReactionsResponse
      setPostedMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const userReacted = new Set(m.userReacted)
          if (alreadyReacted) {
            userReacted.delete(emoji)
          } else {
            userReacted.add(emoji)
          }
          return { ...m, reactions: data.reactions, userReacted }
        }),
      )
    } catch {
      // reaction failure is non-critical; silently ignore
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
              Configure Slack via <code>SLACK_BOT_TOKEN</code> /{' '}
              <code>SLACK_CHANNEL_ID</code> and Teams via{' '}
              <code>TEAMS_WEBHOOK_URL</code> environment variables
              <span className="guide__sub">
                Slack は <code>SLACK_BOT_TOKEN</code> /{' '}
                <code>SLACK_CHANNEL_ID</code>、Teams は{' '}
                <code>TEAMS_WEBHOOK_URL</code> で設定
              </span>
            </li>
            <li>
              Each chat-log session posts into its own thread; use{' '}
              <strong>Start new thread</strong> to begin a fresh one
              <span className="guide__sub">
                セッションごとに別スレッドへ投稿。
                <strong>Start new thread</strong> で新しいスレッドを開始
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
          maxLength={4000}
        />
        <button
          type="submit"
          className="composer__submit"
          disabled={sending || message.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {formStatus.kind === 'error' && (
        <section className="status" aria-live="polite">
          <p className="status__banner status__banner--error">
            ⚠️ {formStatus.message}
          </p>
        </section>
      )}

      {postedMessages.length > 0 && (
        <section className="messages" aria-label="Posted messages">
          <div className="messages__toolbar">
            <button
              type="button"
              className="messages__new-thread"
              onClick={handleNewThread}
            >
              Start new thread
              <span className="messages__new-thread-sub">新しいスレッド</span>
            </button>
          </div>
          {postedMessages.map((msg) => (
            <article key={msg.id} className="message">
              <p className="message__text">{msg.text}</p>

              <ul className="status__list">
                {msg.results.map((r) => (
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
                      {r.skipped
                        ? 'skipped (not configured)'
                        : r.ok
                          ? 'success'
                          : 'failed'}
                      {r.detail && !r.skipped ? ` — ${r.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="reactions">
                {PRESET_EMOJIS.map((emoji) => {
                  const count = msg.reactions[emoji] ?? 0
                  const reacted = msg.userReacted.has(emoji)
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`reaction ${reacted ? 'reaction--reacted' : count > 0 ? 'reaction--active' : ''}`}
                      onClick={() => handleReaction(msg.id, emoji)}
                      aria-label={`${reacted ? 'Remove reaction' : 'React with'} ${emoji}${count > 0 ? `, ${count}` : ''}`}
                    >
                      {emoji}
                      {count > 0 && (
                        <span className="reaction__count">{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
