import { getSlackWebhookUrl, getTeamsWebhookUrl } from '@/lib/config'
import MessageComposer from './MessageComposer'

export const dynamic = 'force-dynamic'

export default function Page() {
  const configured = {
    slack: !!getSlackWebhookUrl(),
    teams: !!getTeamsWebhookUrl(),
  }
  return <MessageComposer configured={configured} />
}
