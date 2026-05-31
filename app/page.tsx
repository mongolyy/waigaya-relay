import { getTeamsWebhookUrl, isSlackConfigured } from '@/lib/config'
import MessageComposer from './MessageComposer'

export const dynamic = 'force-dynamic'

export default function Page() {
  const configured = {
    slack: isSlackConfigured(),
    teams: !!getTeamsWebhookUrl(),
  }
  return <MessageComposer configured={configured} />
}
