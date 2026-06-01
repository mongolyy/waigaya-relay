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

const AVATAR_COLORS = [
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#10b981',
  '#f43f5e',
  '#eab308',
  '#3b82f6',
  '#ec4899',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span
      className="shrink-0 inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold text-white select-none"
      style={{ backgroundColor: getAvatarColor(name) }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

type FloatingEmoji = { id: string; emoji: string; msgId: string }

/** sessionStorage key holding the current chat-log session id. */
const SESSION_KEY = 'waigaya-relay:sessionId'

/**
 * In-memory fallback used when sessionStorage is unavailable (e.g. private
 * browsing or blocked storage). Threading still works within the page lifetime.
 */
let fallbackSessionId: string | null = null

/**
 * Return the current session id, generating and persisting one on first use.
 * All messages sent with the same id are grouped into a single thread.
 */
function getSessionId(): string {
  let id: string | null = null
  try {
    id = window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    // sessionStorage unavailable — fall back to the in-memory id.
  }
  if (!id) {
    id = fallbackSessionId ?? crypto.randomUUID()
    try {
      window.sessionStorage.setItem(SESSION_KEY, id)
    } catch {
      // sessionStorage unavailable — keep the id in memory only.
    }
    fallbackSessionId = id
  }
  return id
}

/** Start a fresh session so subsequent messages open a new thread. */
function resetSessionId(): void {
  const newId = crypto.randomUUID()
  try {
    window.sessionStorage.setItem(SESSION_KEY, newId)
  } catch {
    // sessionStorage unavailable — keep the id in memory only.
  }
  fallbackSessionId = newId
}

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }

type PostedMessage = {
  id: string
  text: string
  username: string
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
  const [reactionFlash, setReactionFlash] = useState<Record<string, boolean>>(
    {},
  )
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])

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
          sessionId: getSessionId(),
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
          username,
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

    const flashKey = `${messageId}-${emoji}`
    setReactionFlash((prev) => ({ ...prev, [flashKey]: true }))

    if (!alreadyReacted) {
      const floatId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setFloatingEmojis((prev) => [
        ...prev,
        { id: floatId, emoji, msgId: messageId },
      ])
    }

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
    <main className="max-w-xl mx-auto py-12 px-5">
      <header className="mb-7">
        <h1 className="m-0 mb-2 text-3xl font-bold">waigaya-relay 📣</h1>
        <p className="m-0 text-slate-400">
          Post a message and relay it to Slack and Microsoft Teams to spark a
          lively discussion.
        </p>
      </header>

      <details className="mb-5 border border-slate-700 rounded-xl overflow-hidden group">
        <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-slate-400 list-none flex items-center gap-2 select-none hover:text-slate-200 [&::-webkit-details-marker]:hidden">
          <span className="text-[0.7rem] transition-transform duration-200 group-open:rotate-90 inline-block">
            ▶
          </span>
          How to use
        </summary>
        <div className="px-5 pt-1 pb-4 border-t border-slate-700 text-sm">
          <ol className="mt-3 mb-2 pl-5 flex flex-col gap-1 list-decimal">
            <li>
              Enter a message and press <strong>Send</strong>
              <span className="block text-[0.85em] text-slate-400 mt-0.5">
                メッセージを入力して <strong>Send</strong> を押す
              </span>
            </li>
            <li>
              The message is posted simultaneously to all configured
              destinations (Slack and Microsoft Teams)
              <span className="block text-[0.85em] text-slate-400 mt-0.5">
                設定済みの送信先（Slack・Microsoft Teams）に同時に投稿される
              </span>
            </li>
            <li>
              Results are displayed at the bottom of the screen
              <span className="block text-[0.85em] text-slate-400 mt-0.5">
                送信結果は画面下部に表示される
              </span>
            </li>
          </ol>
          <ul className="mt-2 pl-5 text-slate-400 flex flex-col gap-1 list-disc">
            <li>
              Maximum 4,000 characters
              <span className="block text-[0.85em] mt-0.5">
                メッセージは最大 4,000 文字
              </span>
            </li>
            <li>
              Configure Slack via{' '}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                SLACK_BOT_TOKEN
              </code>{' '}
              /{' '}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                SLACK_CHANNEL_ID
              </code>{' '}
              and Teams via{' '}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                TEAMS_WEBHOOK_URL
              </code>
              <span className="block text-[0.85em] mt-0.5">
                Slack は{' '}
                <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                  SLACK_BOT_TOKEN
                </code>{' '}
                /{' '}
                <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                  SLACK_CHANNEL_ID
                </code>
                、Teams は{' '}
                <code className="bg-slate-900 px-1 py-0.5 rounded text-[0.85em] text-slate-200">
                  TEAMS_WEBHOOK_URL
                </code>{' '}
                で設定
              </span>
            </li>
            <li>
              Each chat-log session posts into its own thread; use{' '}
              <strong>Start new thread</strong> to begin a fresh one
              <span className="block text-[0.85em] mt-0.5">
                セッションごとに別スレッドへ投稿。
                <strong>Start new thread</strong> で新しいスレッドを開始
              </span>
            </li>
            <li>
              Unconfigured destinations are shown as <em>skipped</em>
              <span className="block text-[0.85em] mt-0.5">
                未設定の送信先は <em>skipped</em> と表示される
              </span>
            </li>
          </ul>
        </div>
      </details>

      {unconfigured.length > 0 && (
        <div
          className="mb-3 px-4 py-3 rounded-lg font-semibold bg-yellow-500/15 text-yellow-500"
          role="alert"
        >
          ⚠️ {unconfigured.map((t) => TARGET_LABEL[t]).join(' and ')}{' '}
          {unconfigured.length === 1 ? 'is' : 'are'} not configured —{' '}
          {unconfigured.length === Object.keys(configured).length
            ? 'all relays will be skipped.'
            : 'that relay will be skipped.'}
        </div>
      )}

      <form
        className="flex flex-col gap-3 bg-slate-800 p-5 rounded-xl"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm">
          <span className="text-slate-400">
            Posting as{' '}
            <strong className="text-slate-200">
              {username || 'Anonymous'}
            </strong>
          </span>
          <button
            type="button"
            className="flex flex-col items-end border-0 bg-transparent text-indigo-400 text-[0.8rem] cursor-pointer p-0 whitespace-nowrap transition-colors duration-150 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onChangeUsername}
            disabled={sending}
          >
            Change name
            <span className="text-[0.7rem] text-slate-400">名前を変更</span>
          </button>
        </div>
        <label className="font-semibold text-sm" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          className="w-full resize-y p-3 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 font-[inherit] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          rows={4}
          placeholder="Write something to get the conversation started…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
          maxLength={4000}
        />
        <button
          type="submit"
          className="self-end px-5 py-2.5 border-0 rounded-lg bg-indigo-500 text-white font-semibold cursor-pointer transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={sending || message.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {formStatus.kind === 'error' && (
        <section className="mt-6" aria-live="polite">
          <p className="m-0 mb-3 px-4 py-3 rounded-lg font-semibold bg-red-500/15 text-red-500">
            ⚠️ {formStatus.message}
          </p>
        </section>
      )}

      {postedMessages.length > 0 && (
        <section
          className="mt-7 flex flex-col gap-4"
          aria-label="Posted messages"
        >
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-transparent text-slate-200 text-sm cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={handleNewThread}
            >
              Start new thread
              <span className="text-[0.72rem] text-slate-400">
                新しいスレッド
              </span>
            </button>
          </div>
          {postedMessages.map((msg) => (
            <article
              key={msg.id}
              className="animate-message-in bg-slate-800 rounded-xl px-5 py-4 flex flex-col gap-3"
            >
              {msg.username && (
                <div className="flex items-center gap-2">
                  <UserAvatar name={msg.username} />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: getAvatarColor(msg.username) }}
                  >
                    {msg.username}
                  </span>
                </div>
              )}
              <p className="m-0 whitespace-pre-wrap break-words">{msg.text}</p>

              <ul className="list-none m-0 p-0 flex flex-col gap-2">
                {msg.results.map((r) => (
                  <li
                    key={r.target}
                    className="flex items-baseline gap-2.5 bg-slate-700/50 px-3.5 py-2.5 rounded-lg"
                  >
                    <span
                      className={`size-2.5 rounded-full shrink-0 translate-y-px ${
                        r.skipped
                          ? 'bg-slate-400'
                          : r.ok
                            ? 'bg-green-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="font-semibold min-w-[7em]">
                      {TARGET_LABEL[r.target]}
                    </span>
                    <span className="text-slate-400 text-sm">
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

              <div className="flex flex-wrap gap-1.5">
                {PRESET_EMOJIS.map((emoji) => {
                  const count = msg.reactions[emoji] ?? 0
                  const reacted = msg.userReacted.has(emoji)
                  const flashKey = `${msg.id}-${emoji}`
                  const isFlashing = reactionFlash[flashKey] ?? false
                  const floats = floatingEmojis.filter(
                    (fe) => fe.msgId === msg.id && fe.emoji === emoji,
                  )
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`relative overflow-visible inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-slate-200 cursor-pointer text-base transition-all duration-150 hover:bg-indigo-500/15 hover:border-indigo-500 ${
                        reacted
                          ? 'bg-indigo-500/30 border-indigo-500'
                          : count > 0
                            ? 'bg-indigo-500/20 border-indigo-500'
                            : 'bg-transparent border-slate-700'
                      } ${isFlashing ? 'animate-reaction-pop' : ''}`}
                      onClick={() => handleReaction(msg.id, emoji)}
                      aria-label={`${reacted ? 'Remove reaction' : 'React with'} ${emoji}${count > 0 ? `, ${count}` : ''}`}
                      onAnimationEnd={(e) => {
                        if (e.target === e.currentTarget) {
                          setReactionFlash((prev) => ({
                            ...prev,
                            [flashKey]: false,
                          }))
                        }
                      }}
                    >
                      {floats.map((fe) => (
                        <span
                          key={fe.id}
                          className="animate-emoji-float pointer-events-none absolute bottom-full left-1/2 z-10 leading-none text-lg"
                          aria-hidden
                          onAnimationEnd={() =>
                            setFloatingEmojis((prev) =>
                              prev.filter((item) => item.id !== fe.id),
                            )
                          }
                        >
                          {fe.emoji}
                        </span>
                      ))}
                      {emoji}
                      {count > 0 && (
                        <span className="text-[0.85rem] font-semibold text-indigo-400">
                          {count}
                        </span>
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
