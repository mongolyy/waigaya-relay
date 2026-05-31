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
    <dialog ref={dialogRef} className="username-dialog">
      <form className="username-dialog__form" onSubmit={handleSubmit}>
        <h2 className="username-dialog__title">
          {isChanging ? 'Change your name' : 'Welcome to waigaya-relay'}
          <span className="username-dialog__sub">
            {isChanging ? '名前を変更' : 'ようこそ'}
          </span>
        </h2>
        {!isChanging && (
          <p className="username-dialog__desc">
            Enter your name to identify your posts.
            <span className="username-dialog__sub">
              投稿に表示される名前を入力してください。
            </span>
          </p>
        )}
        <label className="username-dialog__label" htmlFor="dialog-username">
          Your name
          <span className="username-dialog__sub">名前</span>
        </label>
        <input
          id="dialog-username"
          className="username-dialog__input"
          type="text"
          placeholder="e.g. Alice"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={80}
          autoFocus
        />
        <div className="username-dialog__actions">
          {isChanging && (
            <button
              type="button"
              className="username-dialog__cancel"
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
            className="username-dialog__submit"
            disabled={input.trim().length === 0}
          >
            {isChanging ? 'Save' : 'Start'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
