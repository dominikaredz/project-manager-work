import { useState } from 'react'
import { today } from '../data/projects'
import type { Task } from '../data/projects'
import { Icon } from './ui'
import { statusToneOf } from './format'

const WEEKS = 2
const MAX_PER_DAY = 3
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function DeadlineCalendar({ title, tasks, projectName, onOpenProject }: {
  title: string; tasks: Task[]; projectName: (id?: string) => string; onOpenProject: (id: string) => void
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const todayIso = today()
  const now = new Date(`${todayIso}T12:00:00`)
  const start = addDays(now, -((now.getDay() + 6) % 7) + weekOffset * 7)
  const days = Array.from({ length: WEEKS * 7 }, (_, index) => addDays(start, index))
  const rangeLabel = `${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(days[0])} – ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(days[days.length - 1])}`

  const byDay = new Map<string, Task[]>()
  for (const task of tasks) {
    const due = task.dredz_pm_duedate?.slice(0, 10)
    if (due) byDay.set(due, [...(byDay.get(due) ?? []), task])
  }
  const overdue = tasks.filter(task => task.dredz_pm_duedate && task.dredz_pm_duedate.slice(0, 10) < todayIso)
  const firstIso = isoDate(days[0])
  const lastIso = isoDate(days[days.length - 1])
  const later = tasks.filter(task => task.dredz_pm_duedate && task.dredz_pm_duedate.slice(0, 10) > lastIso).length
  const earlier = tasks.filter(task => { const due = task.dredz_pm_duedate?.slice(0, 10); return due && due >= todayIso && due < firstIso }).length

  const taskButton = (task: Task, showDate = false) => <button key={task.dredz_task1id} className={`cal-task cal-tone-${statusToneOf(task.dredz_pm_status)}`}
    title={`${task.dredz_pm_name} — ${projectName(task._dredz_pm_projectid_value)}`}
    onClick={() => task._dredz_pm_projectid_value && onOpenProject(task._dredz_pm_projectid_value)}>
    {showDate && <span className="cal-task-date">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${task.dredz_pm_duedate!.slice(0, 10)}T12:00:00`))}</span>}
    <span className="cal-task-name">{task.dredz_pm_name}</span>
  </button>

  return <section className="card dash-wide dash-calendar deadline-calendar">
    <div className="card-head">
      <h2>{title}</h2>
      <div className="cal-nav">
        <button className="icon-button bordered" aria-label="Previous week" onClick={() => setWeekOffset(value => value - 1)}><Icon name="chevronLeft" size={16} /></button>
        <button className="secondary cal-today" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>Today</button>
        <button className="icon-button bordered" aria-label="Next week" onClick={() => setWeekOffset(value => value + 1)}><Icon name="chevronRight" size={16} /></button>
        <span className="cal-range">{rangeLabel}</span>
      </div>
    </div>

    {overdue.length > 0 && <div className="cal-overdue">
      <span className="cal-overdue-label"><Icon name="alert" size={14} />Overdue · {overdue.length}</span>
      <div className="cal-overdue-list">{overdue.map(task => taskButton(task, true))}</div>
    </div>}

    <div className="cal-grid" role="grid" aria-label={`Deadlines ${rangeLabel}`}>
      {weekdays.map(day => <div key={day} className="cal-weekday" role="columnheader">{day}</div>)}
      {days.map((day, index) => {
        const iso = isoDate(day)
        const dayTasks = byDay.get(iso) ?? []
        const past = iso < todayIso
        const showMonth = index === 0 || day.getDate() === 1
        return <div key={iso} role="gridcell" className={`cal-day ${iso === todayIso ? 'is-today' : ''} ${past ? 'is-past' : ''} ${index % 7 >= 5 ? 'is-weekend' : ''} ${dayTasks.length ? '' : 'is-empty'}`}>
          <span className="cal-date">
            <span className="cal-weekday-inline">{weekdays[index % 7]} </span>
            {day.getDate()}{showMonth && <span className="cal-month"> {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(day)}</span>}
          </span>
          <div className="cal-tasks">
            {dayTasks.slice(0, MAX_PER_DAY).map(task => taskButton(task))}
            {dayTasks.length > MAX_PER_DAY && <span className="cal-more" title={dayTasks.slice(MAX_PER_DAY).map(task => task.dredz_pm_name).join('\n')}>+{dayTasks.length - MAX_PER_DAY} more</span>}
          </div>
        </div>
      })}
    </div>

    {(earlier > 0 || later > 0) && <p className="muted cal-footer">
      {earlier > 0 && <>{earlier} {earlier === 1 ? 'task' : 'tasks'} earlier · </>}
      {later > 0 ? <>{later} more {later === 1 ? 'deadline' : 'deadlines'} later — <button className="link-button" onClick={() => setWeekOffset(value => value + WEEKS)}>next weeks</button></> : null}
    </p>}
  </section>
}
