'use client'

import { useState } from 'react'
import type { RelayTarget } from '@/lib/types'
import MessageComposer from './MessageComposer'
import UsernameSetupWidget from './UsernameSetupWidget'

export const USERNAME_COOKIE = 'waigaya-username'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function setUsernameCookie(value: string) {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not yet universally available
    document.cookie = `${USERNAME_COOKIE}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
  } catch {
    // cookies may be unavailable in restricted contexts
  }
}

interface Props {
  initialUsername: string
  configured: Record<RelayTarget, boolean>
  initialCode?: string
}

export default function AppShell({
  initialUsername,
  configured,
  initialCode,
}: Props) {
  const [username, setUsername] = useState(initialUsername)
  const [showWidget, setShowWidget] = useState(!initialUsername)

  function handleSaveUsername(name: string) {
    setUsernameCookie(name)
    setUsername(name)
    setShowWidget(false)
  }

  function handleChangeUsername() {
    setShowWidget(true)
  }

  function handleCancelChange() {
    setShowWidget(false)
  }

  return (
    <>
      {showWidget && (
        <UsernameSetupWidget
          isChanging={!!username}
          onSave={handleSaveUsername}
          onCancel={handleCancelChange}
        />
      )}
      <MessageComposer
        configured={configured}
        username={username}
        onChangeUsername={handleChangeUsername}
        initialCode={initialCode}
      />
    </>
  )
}
