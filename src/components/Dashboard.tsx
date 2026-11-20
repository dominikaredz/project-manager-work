import { useState } from 'react'
import { choiceLabel, choices, projectStages, taskStatuses } from '../config/dataverse'
import { daysUntil, lookupName, personName } from '../data/projects'
import type { Lookups, Project, Task, TaskSaved } from '../data/projects'
import { DashboardKanban } from './DashboardKanban'
import { filterMyProjects } from '../data/projectFilters'
import { Avatar, Icon } from './ui'
import { statusToneOf } from './format'
import { DeadlineCalendar } from './DeadlineCalendar'
import type { IconName } from './ui'

export type DashboardScope = 'mine' | 'all'

const statusOrder = [707970001, 707970000, 707970002, 707970003] as const

export function Dashboard({ projects, tasks, tasksError, lookups, scope, onScope, personId, personLoading, personError, onSelectPerson, onOpenProject, onOpenKanban, onTaskChanged }: {
  projects: Project[]; tasks: Task[] | null; tasksError: string; lookups: Lookups
  scope: DashboardScope; onScope: (scope: DashboardScope) => void
  personId: string; personLoading: boolean; personError: string; onSelectPerson: (id: string) => void
  onOpenProject: (id: string) => void; onOpenKanban: (projectId?: string) => void; onTaskChanged: (result: TaskSaved) => void
}) {
  const [candidatePersonId, setCandidatePersonId] = useState('')
  const mine = scope === 'mine'
  const person = lookups.peopleNames.find(item => item.id === personId)
  const firstName = person ? personName(person.name).split(/\s+/)[0] : ''

  const scopedProjects = mine ? filterMyProjects(projects, personId, tasks ?? []) : projects
  const projectIds = new Set(scopedProjects.map(project => project.dredz_project1id))
  const projectTasks = (tasks ?? []).filter(task => task._dredz_pm_projectid_value && projectIds.has(task._dredz_pm_projectid_value))
  // W zakresie „Moje” statystyki i terminy dotyczą zadań przypisanych do mnie; postęp projektów liczy wszystkie zadania projektu.
  const focusTasks = mine ? projectTasks.filter(task => task._dredz_pm_owner_value === personId) : projectTasks
  const openTasks = focusTasks.filter(task => task.dredz_pm_status !== choices.done)
  const overdue = openTasks.filter(task => (daysUntil(task.dredz_pm_duedate) ?? 0) < 0)
  const count = (status: number) => focusTasks.filter(task => task.dredz_pm_status === status).length
  const ownedCount = mine ? scopedProjects.filter(project => project._dredz_pm_owner_value === personId).length : 0

  const stats: { label: string; value: number; hint: string; icon: IconName; tone: string }[] = [
    mine
      ? { label: 'My projects', value: scopedProjects.length, hint: `${ownedCount} owned · ${scopedProjects.length - ownedCount} contributing`, icon: 'folder', tone: 'brand' }
      : { label: 'Active projects', value: scopedProjects.length, hint: `${scopedProjects.filter(project => project.dredz_pm_pinned).length} pinned`, icon: 'folder', tone: 'brand' },
    { label: mine ? 'My tasks in progress' : 'Tasks in progress', value: count(707970001), hint: `${openTasks.length} open in total`, icon: 'clock', tone: 'info' },
    { label: 'Blocked', value: count(707970002), hint: 'need attention', icon: 'alert', tone: 'warning' },
    { label: 'Overdue', value: overdue.length, hint: 'unfinished', icon: 'calendar', tone: 'danger' },
  ]

  const sortedProjects = [...scopedProjects]
    .sort((left, right) => Number(right.dredz_pm_pinned ?? false) - Number(left.dredz_pm_pinned ?? false)
      || (left.dredz_pm_enddate ?? '9999').localeCompare(right.dredz_pm_enddate ?? '9999'))
  const progress = sortedProjects.slice(0, 6).map(project => {
      const own = projectTasks.filter(task => task._dredz_pm_projectid_value === project.dredz_project1id)
      const done = own.filter(task => task.dredz_pm_status === choices.done).length
      return { project, total: own.length, done, percent: own.length ? Math.round(done / own.length * 100) : 0, owned: project._dredz_pm_owner_value === personId }
    })

  const loadByPerson = new Map<string, number>()
  for (const task of projectTasks) if (task.dredz_pm_status !== choices.done && task._dredz_pm_owner_value) loadByPerson.set(task._dredz_pm_owner_value, (loadByPerson.get(task._dredz_pm_owner_value) ?? 0) + 1)
  const workload = [...loadByPerson.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6)
  const maxLoad = Math.max(1, ...workload.map(([, value]) => value))

  const total = focusTasks.length
  const values = statusOrder.map(status => count(status))
  const percentBefore = (index: number) => total ? values.slice(0, index).reduce((sum, value) => sum + value, 0) / total * 100 : 0
  const donut = statusOrder.map((status, index) => ({ status, value: values[index], start: percentBefore(index), end: percentBefore(index + 1) }))
  const gradient = total
    ? `conic-gradient(${donut.map(slice => `var(--tone-${statusToneOf(slice.status)}) ${slice.start}% ${slice.end}%`).join(', ')})`
    : 'conic-gradient(var(--border) 0 100%)'
  const projectName = (id?: string) => projects.find(project => project.dredz_project1id === id)?.dredz_pm_name ?? '—'

  const scopeSwitch = <div className="segmented" role="group" aria-label="Dashboard scope">
    <button className={mine ? 'active' : ''} aria-pressed={mine} onClick={() => onScope('mine')}>My projects</button>
    <button className={mine ? '' : 'active'} aria-pressed={!mine} onClick={() => onScope('all')}>All projects</button>
  </div>

  const header = <div className="dash-header">
    <div>
      <h2 className="dash-greeting">{mine && firstName ? `Hi, ${firstName}` : mine ? 'My work' : 'Team overview'}</h2>
      <p className="muted">{mine ? 'Projects you own or have open tasks in.' : 'All active projects of the team.'}</p>
    </div>
    {scopeSwitch}
  </div>

  if (mine && !personId) {
    return <div className="dashboard">
      {header}
      <section className="card dash-identify">
        {personLoading
          ? <p role="status" className="muted">Identifying the signed-in person…</p>
          : <>
            <p>{personError || 'Select who you are to see your projects.'}</p>
            <div className="my-person-picker">
              <label>Who are you?
                <select value={candidatePersonId} onChange={event => setCandidatePersonId(event.target.value)}>
                  <option value="">Select a person</option>
                  {lookups.people.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="actions">
                <button disabled={!candidatePersonId} onClick={() => onSelectPerson(candidatePersonId)}>Use this person</button>
                <button className="secondary" onClick={() => onScope('all')}>Show all projects</button>
              </div>
            </div>
          </>}
      </section>
    </div>
  }

  return <div className="dashboard">
    {header}
    {tasksError && <div className="error" role="alert">Could not load tasks. {tasksError}</div>}
    <div className="stat-grid">
      {stats.map(stat => <div className="card stat-card" key={stat.label}>
        <span className={`stat-icon tone-${stat.tone}`}><Icon name={stat.icon} size={20} /></span>
        <div><p className="stat-label">{stat.label}</p><p className="stat-value">{tasks ? stat.value : '–'}</p><p className="stat-hint">{stat.hint}</p></div>
      </div>)}
    </div>

    <div className="dash-grid">
      <section className="card dash-progress">
        <div className="card-head"><h2>{mine ? 'My project progress' : 'Project progress'}</h2><button className="link-button" onClick={() => onOpenProject('')}>View all <Icon name="arrowRight" size={14} /></button></div>
        {tasks && !progress.length && <div className="empty"><p>{mine ? "You don't have any active projects yet." : 'No active projects.'}</p>
          {mine && <button className="secondary" onClick={() => onScope('all')}>Show all projects</button>}</div>}
        <ul className="progress-list">{progress.map(({ project, total, done, percent, owned }) => <li key={project.dredz_project1id}>
          <button className="progress-row" onClick={() => onOpenProject(project.dredz_project1id)}>
            <span className="progress-name">{project.dredz_pm_pinned && <span className="pin"><Icon name="star" size={12} /></span>}{project.dredz_pm_name}
              {mine && <span className={`chip ${owned ? 'chip-brand' : 'chip-neutral'} role-chip`}>{owned ? 'Owner' : 'Contributor'}</span>}</span>
            <span className="progress-meta">{choiceLabel(projectStages, project.dredz_pm_stage)} · {done}/{total} tasks</span>
            <span className="bar"><span style={{ width: `${percent}%` }} /></span>
            <span className="progress-percent">{percent}%</span>
          </button>
        </li>)}</ul>
      </section>

      <section className="card dash-tasks">
        <div className="card-head"><h2>{mine ? 'My tasks' : 'Tasks'}</h2><button className="link-button" onClick={() => onOpenKanban()}>Kanban <Icon name="arrowRight" size={14} /></button></div>
        <div className="donut-wrap">
          <div className="donut" style={{ background: gradient }}><div><strong>{tasks ? total : '–'}</strong><span>tasks</span></div></div>
          <ul className="legend">{donut.map(slice => <li key={slice.status}>
            <span className={`dot tone-bg-${statusToneOf(slice.status)}`} />{taskStatuses[slice.status]}<strong>{slice.value}</strong>
          </li>)}</ul>
        </div>
      </section>

      <section className="card dash-team">
        <div className="card-head"><h2>{mine ? 'Team on my projects' : 'Team workload'}</h2><span className="muted">open tasks</span></div>
        {tasks && !workload.length && <p className="empty">No assigned tasks.</p>}
        <ul className="workload">{workload.map(([id, value]) => {
          const name = lookupName(lookups.peopleNames, id)
          return <li key={id} className={id === personId ? 'is-me' : undefined}><Avatar name={name} /><span className="workload-name">{personName(name)}{id === personId && ' (you)'}</span>
            <span className="bar bar-thin"><span style={{ width: `${value / maxLoad * 100}%` }} /></span><strong>{value}</strong></li>
        })}</ul>
      </section>

      <DashboardKanban projects={sortedProjects} tasks={tasks} lookups={lookups} personId={personId} onChanged={onTaskChanged} onOpenKanban={onOpenKanban} />

      <DeadlineCalendar title={mine ? 'My upcoming deadlines' : 'Upcoming deadlines'} tasks={openTasks} projectName={projectName} onOpenProject={onOpenProject} />
    </div>
  </div>
}
