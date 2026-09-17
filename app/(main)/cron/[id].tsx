// Not a screen — a redirect. See `app/(main)/cron/index.tsx` for the
// reasoning; this one carries the job id straight through to the Tasks
// detail route so a deep link to a specific job still opens that job.
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function CronDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <Redirect href={{ params: { id }, pathname: '/(main)/tasks/[id]' }} />
}
