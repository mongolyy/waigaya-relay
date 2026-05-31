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
  username: string
  onChangeUsername: () => void
}

export default function MessageComposer({
  configured,
  username,
  onChangeUsername,
}: Props) {
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
        body: JSON.stringify({
          message: trimmed,
          ...(username ? { username } : {}),
        }),
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
        <div className="composer__identity">
          <span className="composer__identity-name">
            Posting as <strong>{username || 'Anonymous'}</strong>
          </span>
          <button
            type="button"
            className="composer__identity-change"
            onClick={onChangeUsername}
            disabled={sending}
          >
            Change name
            <span className="composer__identity-change-sub">名前を変更</span>
          </button>
        </div>
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
