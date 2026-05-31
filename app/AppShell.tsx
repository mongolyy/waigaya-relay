'use client'

import { useState } from 'react'
import type { RelayTarget } from '@/lib/types'
import MessageComposer from './MessageComposer'
import UsernameSetupWidget from './UsernameSetupWidget'

export const USERNAME_COOKIE = 'waigaya-username'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function setUsernameCookie(value: string) {
  try {
    document.cookie = `${USERNAME_COOKIE}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
  } catch {
    // cookies may be unavailable in restricted contexts
  }
}

function clearUsernameCookie() {
  try {
    document.cookie = `${USERNAME_COOKIE}=; max-age=0; path=/`
  } catch {
    // cookies may be unavailable in restricted contexts
  }
}

interface Props {
  initialUsername: string
  configured: Record<RelayTarget, boolean>
}

export default function AppShell({ initialUsername, configured }: Props) {
  const [username, setUsername] = useState(initialUsername)

  function handleSaveUsername(name: string) {
    setUsernameCookie(name)
    setUsername(name)
  }

  function handleChangeUsername() {
    clearUsernameCookie()
    setUsername('')
  }

  return (
    <>
      {!username && <UsernameSetupWidget onSave={handleSaveUsername} />}
      <MessageComposer
        configured={configured}
        username={username}
        onChangeUsername={handleChangeUsername}
      />
    </>
  )
}
