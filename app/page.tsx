import { cookies } from 'next/headers'
import { getTeamsWebhookUrl, isSlackConfigured } from '@/lib/config'
import AppShell, { USERNAME_COOKIE } from './AppShell'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ code?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const rawUsername = cookieStore.get(USERNAME_COOKIE)?.value ?? ''
  let username = rawUsername
  try {
    username = decodeURIComponent(rawUsername)
  } catch {
    // keep the raw value if it can't be decoded
  }
  const { code } = await searchParams

  const configured = {
    slack: isSlackConfigured(),
    teams: !!getTeamsWebhookUrl(),
  }

  return (
    <AppShell
      initialUsername={username}
      configured={configured}
      initialCode={code}
    />
  )
}
