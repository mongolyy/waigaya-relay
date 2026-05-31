import { getSlackWebhookUrl, getTeamsWebhookUrl } from '@/lib/config'
import MessageComposer from './MessageComposer'

export default function Page() {
  const configured = {
    slack: !!getSlackWebhookUrl(),
    teams: !!getTeamsWebhookUrl(),
  }
  return <MessageComposer configured={configured} />
}
