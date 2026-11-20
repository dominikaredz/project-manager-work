import { choices } from '../config/dataverse'
import type { Project, Task } from './projects'

export type MyTaskSections = {
  overdue: Task[]
  thisWeek: Task[]
  nextWeek: Task[]
  later: Task[]
  noDueDate: Task[]
}

function polandDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function dateNumber(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return NaN
  return Date.UTC(year, month - 1, day) / 86400000
}

export function groupMyTasks(tasks: Task[], activeProjects: Project[], personId: string, now = new Date()): MyTaskSections {
  const sections: MyTaskSections = { overdue: [], thisWeek: [], nextWeek: [], later: [], noDueDate: [] }
  if (!personId) return sections

  const projectIds = new Set(activeProjects.map(project => project.dredz_project1id))
  const today = polandDate(now)
  const todayNumber = dateNumber(today)
  const weekday = new Date(todayNumber * 86400000).getUTCDay()
  const thisWeekStart = todayNumber - ((weekday + 6) % 7)
  const thisWeekEnd = thisWeekStart + 6
  const nextWeekEnd = thisWeekEnd + 7

  for (const task of tasks) {
    const projectId = task._dredz_pm_projectid_value
    if (task._dredz_pm_owner_value !== personId || task.dredz_pm_status === choices.done || !projectId || !projectIds.has(projectId)) continue
    if (!task.dredz_pm_duedate) {
      sections.noDueDate.push(task)
      continue
    }

    const dueDate = dateNumber(task.dredz_pm_duedate)
    if (!Number.isFinite(dueDate)) continue
    if (dueDate < todayNumber) sections.overdue.push(task)
    else if (dueDate <= thisWeekEnd) sections.thisWeek.push(task)
    else if (dueDate <= nextWeekEnd) sections.nextWeek.push(task)
    else sections.later.push(task)
  }

  return sections
}

export function daysSinceActivity(value?: string, now = new Date()) {
  if (!value) return undefined
  const activityDate = dateNumber(value)
  const today = dateNumber(polandDate(now))
  if (!Number.isFinite(activityDate) || !Number.isFinite(today)) return undefined
  return today - activityDate
}
