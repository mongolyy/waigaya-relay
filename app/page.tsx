import { cookies } from 'next/headers'
import { getTeamsWebhookUrl, isSlackConfigured } from '@/lib/config'
import AppShell, { USERNAME_COOKIE } from './AppShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const cookieStore = await cookies()
  const username = cookieStore.get(USERNAME_COOKIE)?.value ?? ''

  const configured = {
    slack: isSlackConfigured(),
    teams: !!getTeamsWebhookUrl(),
  }

  return <AppShell initialUsername={username} configured={configured} />
}
