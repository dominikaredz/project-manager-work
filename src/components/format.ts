const statusTone: Record<number, string> = { 707970000: 'neutral', 707970001: 'brand', 707970002: 'danger', 707970003: 'success' }
export const priorityTone: Record<number, string> = { 707970000: 'neutral', 707970001: 'warning', 707970002: 'danger' }

export function statusToneOf(status?: number) { return status == null ? 'neutral' : statusTone[status] ?? 'neutral' }

export function relativeDays(days: number) {
  if (days < -1) return `${-days} days overdue`
  if (days === -1) return 'Yesterday'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}
