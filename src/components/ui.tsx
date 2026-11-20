import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { choiceLabel, taskPriorities, taskStatuses } from '../config/dataverse'
import { daysUntil, initials, personName } from '../data/projects'
import { priorityTone, statusToneOf } from './format'

const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  kanban: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  x: 'M18 6 6 18M6 6l12 12',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open') }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal">
      <button type="button" className="icon-button modal-close" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      {children}
    </div>
  </div>
}

export function Avatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  if (!name || name === '—') return <span className={`avatar avatar-${size} avatar-empty`} title="Unassigned">?</span>
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return <span className={`avatar avatar-${size}`} style={{ '--avatar-hue': hash } as CSSProperties} title={personName(name)}>{initials(name)}</span>
}

export function StatusChip({ status }: { status?: number }) {
  return <span className={`chip chip-${statusToneOf(status)}`}>{choiceLabel(taskStatuses, status)}</span>
}

export function PriorityChip({ priority }: { priority?: number }) {
  if (priority == null) return null
  return <span className={`chip chip-${priorityTone[priority] ?? 'neutral'}`}>{choiceLabel(taskPriorities, priority)}</span>
}

export function DueLabel({ date, done = false }: { date?: string; done?: boolean }) {
  const days = daysUntil(date)
  if (days === undefined) return <span className="due muted">No due date</span>
  const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${date!.slice(0, 10)}T12:00:00`))
  const tone = done ? '' : days < 0 ? 'due-overdue' : days <= 2 ? 'due-soon' : ''
  return <span className={`due ${tone}`}><Icon name="calendar" size={13} />{label}</span>
}
