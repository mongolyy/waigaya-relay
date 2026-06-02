'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GetMessagesResponse,
  PostMessageResponse,
  ReactionsResponse,
  RelayResult,
  RelayTarget,
  StoredMessage,
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

function RelayStatusBadge({ result }: { result: RelayResult }) {
  const dotColor = result.skipped
    ? 'bg-slate-400'
    : result.ok
      ? 'bg-green-500'
      : 'bg-red-500'
  const tooltip = result.skipped
    ? 'skipped (not configured)'
    : result.ok
      ? 'success'
      : `failed${result.detail ? ` — ${result.detail}` : ''}`

  return (
    <div className="relative group inline-flex items-center gap-1.5 cursor-default">
      <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-xs text-slate-400">{TARGET_LABEL[result.target]}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
      >
        {tooltip}
      </span>
    </div>
  )
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

/** sessionStorage key holding the current conversation code. */
const SESSION_KEY = 'waigaya-relay:sessionId'

const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 12
const CODE_PATTERN = /^[a-z0-9]{12}$/

let fallbackCode: string | null = null

function saveCode(code: string): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, code)
  } catch {
    // sessionStorage unavailable — code lives only in component state.
  }
  fallbackCode = code
}

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

function findExistingCode(initialCode?: string): string | null {
  if (initialCode && CODE_PATTERN.test(initialCode)) return initialCode
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY)
      if (stored && CODE_PATTERN.test(stored)) return stored
    } catch {
      // sessionStorage unavailable
    }
  }
  return fallbackCode
}

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }

type PostedMessage = StoredMessage & {
  userReacted: Set<string>
  /** Only present for messages the current user sent in this session. */
  relayStatus?: {
    ok: boolean
    allSkipped: boolean
    results: RelayResult[]
  }
}

interface Props {
  configured: Record<RelayTarget, boolean>
  username: string
  onChangeUsername: () => void
  initialCode?: string
}

export default function MessageComposer({
  configured,
  username,
  onChangeUsername,
  initialCode,
}: Props) {
  const [phase, setPhase] = useState<'setup' | 'active'>(() =>
    findExistingCode(initialCode) ? 'active' : 'setup',
  )
  const [conversationCode, setConversationCode] = useState(
    () => findExistingCode(initialCode) ?? '',
  )
  const [copyLabel, setCopyLabel] = useState<'copy' | 'copied'>('copy')
  const [message, setMessage] = useState('')
  const [formStatus, setFormStatus] = useState<FormStatus>({ kind: 'idle' })
  const [postedMessages, setPostedMessages] = useState<PostedMessage[]>([])
  const [reactionFlash, setReactionFlash] = useState<Record<string, boolean>>(
    {},
  )
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])

  // Tracks relay results for messages the current user sent (keyed by messageId).
  const localRelayStatus = useRef(
    new Map<
      string,
      { ok: boolean; allSkipped: boolean; results: RelayResult[] }
    >(),
  )
  // Tracks emojis the current user has reacted to (keyed by messageId).
  const localUserReacted = useRef(new Map<string, Set<string>>())
  // Prevents double-submit: tracks in-flight reaction requests by "messageId-emoji".
  const pendingReactions = useRef(new Set<string>())

  // Poll the server for messages every 3 seconds.
  useEffect(() => {
    if (phase !== 'active' || !conversationCode) return
    let cancelled = false

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch(`/api/messages?sessionId=${conversationCode}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as GetMessagesResponse
        setPostedMessages((prev) => {
          if (!data || !Array.isArray(data.messages)) return prev
          const prevMap = new Map(prev.map((m) => [m.id, m]))
          const serverIds = new Set(data.messages.map((m) => m.id))
          const localOnly = prev.filter((m) => !serverIds.has(m.id))
          const updated = data.messages.map((serverMsg) => {
            const existing = prevMap.get(serverMsg.id)
            return {
              ...serverMsg,
              userReacted:
                localUserReacted.current.get(serverMsg.id) ??
                existing?.userReacted ??
                new Set<string>(),
              relayStatus:
                localRelayStatus.current.get(serverMsg.id) ??
                existing?.relayStatus,
            }
          })
          return [...updated, ...localOnly]
        })
      } catch {
        // polling failure is non-critical; silently ignore
      }
    }

    poll()
    const id = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [phase, conversationCode])

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
          sessionId: conversationCode,
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
      const relayStatus = { ok: data.ok, allSkipped, results: data.results }
      localRelayStatus.current.set(data.messageId, relayStatus)
      setPostedMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          text: trimmed,
          username: username || undefined,
          createdAt: new Date().toISOString(),
          reactions: {},
          userReacted: new Set(),
          relayStatus,
        },
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

  function handleStartNew() {
    const newCode = generateCode()
    saveCode(newCode)
    setConversationCode(newCode)
    setPostedMessages([])
    setFormStatus({ kind: 'idle' })
    localRelayStatus.current.clear()
    localUserReacted.current.clear()
    setPhase('active')
  }

  function handleNewThread() {
    handleStartNew()
  }

  function handleLeave() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // sessionStorage unavailable
    }
    fallbackCode = null
    setConversationCode('')
    setPostedMessages([])
    setFormStatus({ kind: 'idle' })
    localRelayStatus.current.clear()
    localUserReacted.current.clear()
    setPhase('setup')
  }

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(conversationCode)
      setCopyLabel('copied')
      setTimeout(() => setCopyLabel('copy'), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }, [conversationCode])

  async function handleReaction(messageId: string, emoji: string) {
    const pendingKey = `${messageId}-${emoji}`
    if (pendingReactions.current.has(pendingKey)) return
    pendingReactions.current.add(pendingKey)

    const msg = postedMessages.find((m) => m.id === messageId)
    const alreadyReacted = msg?.userReacted.has(emoji) ?? false

    const flashKey = pendingKey
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
      const reacted =
        localUserReacted.current.get(messageId) ?? new Set<string>()
      if (alreadyReacted) reacted.delete(emoji)
      else reacted.add(emoji)
      localUserReacted.current.set(messageId, reacted)
      setPostedMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          return {
            ...m,
            reactions: data.reactions,
            userReacted: new Set(reacted),
          }
        }),
      )
    } catch {
      // reaction failure is non-critical; silently ignore
    } finally {
      pendingReactions.current.delete(pendingKey)
    }
  }

  if (phase === 'setup') {
    return (
      <main className="max-w-xl mx-auto py-12 px-5">
        <header className="mb-8">
          <h1 className="m-0 mb-2 text-3xl font-bold">waigaya-relay 📣</h1>
          <p className="m-0 text-slate-400">
            Post a message and relay it to Slack and Microsoft Teams to spark a
            lively discussion.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            className="w-full flex flex-col items-start gap-1 px-6 py-5 rounded-xl bg-indigo-500 hover:bg-indigo-600 transition-colors cursor-pointer border-0 text-left"
            onClick={handleStartNew}
          >
            <span className="font-bold text-white text-base">
              Start new conversation
            </span>
            <span className="text-indigo-200 text-sm">新しい会話を始める</span>
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto py-12 px-5">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 mb-2 text-3xl font-bold">waigaya-relay 📣</h1>
          <p className="m-0 text-slate-400">
            Post a message and relay it to Slack and Microsoft Teams to spark a
            lively discussion.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 flex flex-col items-center gap-0.5 mt-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-transparent text-slate-400 text-xs cursor-pointer hover:text-slate-200 hover:border-slate-500 transition-colors"
          onClick={handleLeave}
        >
          Leave
          <span className="text-[0.7rem] text-slate-500">退出</span>
        </button>
      </header>

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        <div>
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
                  Results are displayed in the message log
                  <span className="block text-[0.85em] text-slate-400 mt-0.5">
                    送信結果はメッセージログに表示される
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

            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-slate-400 text-xs">
                  Conversation code
                  <span className="ml-1.5 text-[0.7rem] text-slate-500">
                    会話コード
                  </span>
                </span>
                <code className="font-mono text-slate-200 truncate">
                  {conversationCode}
                </code>
              </div>
              <button
                type="button"
                className="shrink-0 px-2.5 py-1 rounded border border-slate-700 bg-transparent text-slate-400 text-xs cursor-pointer hover:text-slate-200 hover:border-slate-500 transition-colors"
                onClick={handleCopyCode}
              >
                {copyLabel === 'copied' ? '✓ Copied' : 'Copy'}
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
            <section className="mt-4" aria-live="polite">
              <p className="m-0 px-4 py-3 rounded-lg font-semibold bg-red-500/15 text-red-500">
                ⚠️ {formStatus.message}
              </p>
            </section>
          )}
        </div>

        <div>
          {postedMessages.length > 0 && (
            <section
              className="flex flex-col gap-4 mt-7 md:mt-0"
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {msg.username && (
                        <>
                          <UserAvatar name={msg.username} />
                          <span
                            className="text-xs font-semibold"
                            style={{ color: getAvatarColor(msg.username) }}
                          >
                            {msg.username}
                          </span>
                        </>
                      )}
                    </div>
                    {msg.relayStatus && (
                      <div className="flex items-center gap-3 ml-auto">
                        {msg.relayStatus.results.map((r) => (
                          <RelayStatusBadge key={r.target} result={r} />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="m-0 whitespace-pre-wrap break-words">
                    {msg.text}
                  </p>

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
        </div>
      </div>
    </main>
  )
}
