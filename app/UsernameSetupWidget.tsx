'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** True when the user already has a name and is changing it. */
  isChanging?: boolean
  onSave: (username: string) => void
  onCancel?: () => void
}

export default function UsernameSetupWidget({
  isChanging = false,
  onSave,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()

    if (isChanging) {
      // Allow Escape and clicking outside to dismiss when changing name.
      const handleCancel = () => onCancel?.()
      const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === dialog) {
          dialog.close()
          onCancel?.()
        }
      }
      dialog.addEventListener('cancel', handleCancel)
      dialog.addEventListener('click', handleBackdropClick)
      return () => {
        dialog.removeEventListener('cancel', handleCancel)
        dialog.removeEventListener('click', handleBackdropClick)
      }
    }

    // Initial setup: force the user to enter a name.
    const handleCancel = (e: Event) => e.preventDefault()
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [isChanging, onCancel])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    onSave(trimmed)
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto border-0 rounded-2xl bg-slate-800 text-slate-200 p-9 w-[calc(100vw_-_32px)] max-w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <h2 className="m-0 text-xl flex flex-col gap-1">
          {isChanging ? 'Change your name' : 'Welcome to waigaya-relay'}
          <span className="block text-xs font-normal text-slate-400">
            {isChanging ? '名前を変更' : 'ようこそ'}
          </span>
        </h2>
        {!isChanging && (
          <p className="m-0 text-slate-400 text-sm flex flex-col gap-0.5">
            Enter your name to identify your posts.
            <span className="block text-xs text-slate-400">
              投稿に表示される名前を入力してください。
            </span>
          </p>
        )}
        <label
          className="font-semibold text-sm flex flex-col gap-0.5"
          htmlFor="dialog-username"
        >
          Your name
          <span className="block text-xs font-normal text-slate-400">名前</span>
        </label>
        <input
          id="dialog-username"
          className="w-full p-3 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          type="text"
          placeholder="e.g. Alice"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={80}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          {isChanging && (
            <button
              type="button"
              className="px-5 py-2.5 border border-slate-700 rounded-lg bg-transparent text-slate-400 text-base cursor-pointer transition-all hover:text-slate-200 hover:border-slate-200"
              onClick={() => {
                dialogRef.current?.close()
                onCancel?.()
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-7 py-2.5 border-0 rounded-lg bg-indigo-500 text-white font-semibold text-base cursor-pointer transition-colors hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={input.trim().length === 0}
          >
            {isChanging ? 'Save' : 'Start'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
