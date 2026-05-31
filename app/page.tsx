'use client'

import { useState } from 'react'
import type {
  PostMessageResponse,
  ReactionsResponse,
  RelayResult,
} from '@/lib/types'

const TARGET_LABEL: Record<RelayResult['target'], string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
}

const PRESET_EMOJIS = ['👍', '❤️', '😄', '🎉', '🤔', '👀']

type PostedMessage = {
  id: string
  text: string
  reactions: Record<string, number>
  ok: boolean
  results: RelayResult[]
}

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }

export default function Home() {
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState<FormStatus>({ kind: 'idle' })
  const [postedMessages, setPostedMessages] = useState<PostedMessage[]>([])

  const sending = formStatus.kind === 'sending'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || sending) return

    setFormStatus({ kind: 'sending' })

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
        setFormStatus({ kind: 'error', message: data.error })
        return
      }

      setPostedMessages((prev) => [
        {
          id: data.messageId,
          text: trimmed,
          reactions: {},
          ok: data.ok,
          results: data.results,
        },
        ...prev,
      ])
      setFormStatus({ kind: 'idle' })
      if (data.ok) setMessage('')
    } catch {
      setFormStatus({
        kind: 'error',
        message: 'Failed to send. Please check your network connection.',
      })
    }
  }

  async function handleReaction(messageId: string, emoji: string) {
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      })
      const data = (await res.json()) as ReactionsResponse
      setPostedMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: data.reactions } : m,
        ),
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
                      {r.skipped ? 'skipped' : r.ok ? 'success' : 'failed'}
                      {r.detail ? ` — ${r.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="reactions">
                {PRESET_EMOJIS.map((emoji) => {
                  const count = msg.reactions[emoji] ?? 0
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`reaction ${count > 0 ? 'reaction--active' : ''}`}
                      onClick={() => handleReaction(msg.id, emoji)}
                      aria-label={`React with ${emoji}${count > 0 ? `, ${count}` : ''}`}
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
