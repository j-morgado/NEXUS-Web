type UsageEvent = { type: string; moduleId?: string; productId?: string; at: string }
const events: UsageEvent[] = []

export function recordUsage(event: Omit<UsageEvent, 'at'>) {
  events.push({ ...event, at: new Date().toISOString() })
}

export function getUsageEvents() {
  return [...events]
}
