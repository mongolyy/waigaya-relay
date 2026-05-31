'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onSave: (username: string) => void
}

export default function UsernameSetupWidget({ onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const handleCancel = (e: Event) => e.preventDefault()
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [])

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
          Welcome to waigaya-relay
          <span className="username-dialog__sub">ようこそ</span>
        </h2>
        <p className="username-dialog__desc">
          Enter your name to identify your posts.
          <span className="username-dialog__sub">
            投稿に表示される名前を入力してください。
          </span>
        </p>
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
          // biome-ignore lint/a11y/noAutofocus: modal dialog always opens to this field
          autoFocus
        />
        <button
          type="submit"
          className="username-dialog__submit"
          disabled={input.trim().length === 0}
        >
          Start
        </button>
      </form>
    </dialog>
  )
}
