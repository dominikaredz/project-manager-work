import { useState } from 'react'
import { choices, taskStatuses } from '../config/dataverse'
import { errorMessage, lookupName, updateTaskStatus } from '../data/projects'
import type { Lookups, Project, Task, TaskSaved } from '../data/projects'
import { Avatar, DueLabel, Icon } from './ui'
import { statusToneOf } from './format'

type Status = NonNullable<Task['dredz_pm_status']>
const columns = Object.keys(taskStatuses).map(Number) as Status[]
const MAX_CARDS = 4

export function DashboardKanban({ projects, tasks, lookups, personId, onChanged, onOpenKanban }: {
  projects: Project[]; tasks: Task[] | null; lookups: Lookups; personId: string
  onChanged: (result: TaskSaved) => void; onOpenKanban: (projectId: string) => void
}) {
  const [chosenId, setChosenId] = useState('')
  const [moved, setMoved] = useState<Record<string, Status>>({})
  const [dragId, setDragId] = useState('')
  const [overColumn, setOverColumn] = useState<Status | null>(null)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  const projectId = projects.some(project => project.dredz_project1id === chosenId) ? chosenId : projects[0]?.dredz_project1id ?? ''
  const projectTasks = (tasks ?? [])
    .filter(task => task._dredz_pm_projectid_value === projectId)
    .map(task => moved[task.dredz_task1id] !== undefined && moved[task.dredz_task1id] !== task.dredz_pm_status ? { ...task, dredz_pm_status: moved[task.dredz_task1id] } : task)

  async function move(task: Task, status: Status) {
    if (savingId || task.dredz_pm_status === status || !task._dredz_pm_projectid_value) return
    setMoved(previous => ({ ...previous, [task.dredz_task1id]: status }))
    setSavingId(task.dredz_task1id)
    setError('')
    try { onChanged(await updateTaskStatus(task.dredz_task1id, task._dredz_pm_projectid_value, status)) }
    catch (error) {
      setMoved(previous => { const next = { ...previous }; delete next[task.dredz_task1id]; return next })
      setError(`Could not move the task. ${errorMessage(error)}`)
    }
    finally { setSavingId('') }
  }

  return <section className="card dash-kanban">
    <div className="card-head">
      <h2>Project board</h2>
      <div className="actions">
        {projects.length > 0 && <select className="dash-kanban-select" aria-label="Project shown on the board" value={projectId} onChange={event => { setChosenId(event.target.value); setError('') }}>
          {projects.map(project => <option key={project.dredz_project1id} value={project.dredz_project1id}>{project.dredz_pm_name}</option>)}
        </select>}
        <button className="link-button" disabled={!projectId} onClick={() => onOpenKanban(projectId)}>Open <Icon name="arrowRight" size={14} /></button>
      </div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!projects.length ? <p className="empty">No projects to show.</p>
      : !tasks ? <p className="muted" role="status">Loading board…</p>
        : <div className="mini-kanban">
          {columns.map(status => {
            const items = projectTasks.filter(task => (task.dredz_pm_status ?? choices.notStarted) === status)
            return <div key={status} className={`mini-column ${overColumn === status ? 'drop-target' : ''}`} aria-label={taskStatuses[status]}
              onDragOver={event => { if (dragId) { event.preventDefault(); setOverColumn(status) } }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverColumn(null) }}
              onDrop={event => {
                event.preventDefault()
                const task = projectTasks.find(row => row.dredz_task1id === dragId)
                setOverColumn(null); setDragId('')
                if (task) void move(task, status)
              }}>
              <div className="mini-head"><span className={`dot tone-bg-${statusToneOf(status)}`} />{taskStatuses[status]}<span className="count">{items.length}</span></div>
              {items.slice(0, MAX_CARDS).map(task => {
                const owner = lookupName(lookups.peopleNames, task._dredz_pm_owner_value)
                const done = task.dredz_pm_status === choices.done
                return <div key={task.dredz_task1id} draggable={!savingId}
                  className={`mini-card ${done ? 'done' : ''} ${task._dredz_pm_owner_value === personId ? 'is-mine' : ''} ${dragId === task.dredz_task1id ? 'dragging' : ''} ${savingId === task.dredz_task1id ? 'saving' : ''}`}
                  onDragStart={event => { setDragId(task.dredz_task1id); event.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { setDragId(''); setOverColumn(null) }}>
                  <span className="mini-title" title={task.dredz_pm_name}>{task.dredz_pm_name}</span>
                  <span className="mini-meta"><DueLabel date={task.dredz_pm_duedate} done={done} /><Avatar name={owner} size="sm" /></span>
                </div>
              })}
              {items.length > MAX_CARDS && <button className="link-button mini-more" onClick={() => onOpenKanban(projectId)}>+{items.length - MAX_CARDS} more</button>}
              {!items.length && <p className="mini-empty">—</p>}
            </div>
          })}
        </div>}
  </section>
}
