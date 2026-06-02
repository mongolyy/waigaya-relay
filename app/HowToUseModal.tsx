'use client'

import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

export default function HowToUseModal({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key is handled via useEffect above
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss is a standard modal UX pattern
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-use-title"
        className="relative w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl p-6 text-sm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="how-to-use-title" className="m-0 text-base font-bold">
            How to use
            <span className="ml-2 text-xs font-normal text-slate-400">
              使い方
            </span>
          </h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors text-xl leading-none border-0 bg-transparent cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ol className="mt-0 mb-3 pl-5 flex flex-col gap-1 list-decimal">
          <li>
            Enter a message and press <strong>Send</strong>
            <span className="block text-[0.85em] text-slate-400 mt-0.5">
              メッセージを入力して <strong>Send</strong> を押す
            </span>
          </li>
          <li>
            The message is posted simultaneously to all configured destinations
            (Slack and Microsoft Teams)
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

        <ul className="pl-5 text-slate-400 flex flex-col gap-1 list-disc">
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
    </div>
  )
}
