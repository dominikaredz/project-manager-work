import { useEffect, useMemo, useState } from 'react'
import { choices, taskStatuses } from '../config/dataverse'
import { errorMessage, loadAllTasks, lookupName, updateTaskStatus } from '../data/projects'
import type { Lookups, Project, Task, TaskSaved } from '../data/projects'
import { Avatar, DueLabel, Icon, PriorityChip } from './ui'
import { statusToneOf } from './format'

type Status = NonNullable<Task['dredz_pm_status']>
const columns = Object.keys(taskStatuses).map(Number) as Status[]

export function KanbanBoard({ projects, lookups, revision, projectFilter, onProjectFilter, disabled, onEdit, onChanged }: {
  projects: Project[]; lookups: Lookups; revision: number
  projectFilter: string; onProjectFilter: (id: string) => void; disabled: boolean
  onEdit: (task: Task) => void; onChanged: (result: TaskSaved) => void
}) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState('')
  const [moveError, setMoveError] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [dragId, setDragId] = useState('')
  const [overColumn, setOverColumn] = useState<Status | null>(null)
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    let active = true
    loadAllTasks().then(rows => { if (active) { setTasks(rows); setError('') } })
      .catch(error => { if (active) setError(errorMessage(error)) })
    return () => { active = false }
  }, [revision])

  const projectIds = useMemo(() => new Set(projects.map(project => project.dredz_project1id)), [projects])
  const visible = (tasks ?? []).filter(task => task._dredz_pm_projectid_value && projectIds.has(task._dredz_pm_projectid_value)
    && (!projectFilter || task._dredz_pm_projectid_value === projectFilter)
    && (!personFilter || task._dredz_pm_owner_value === personFilter))
  const people = lookups.peopleNames.filter(person => (tasks ?? []).some(task => task._dredz_pm_owner_value === person.id))
  const projectName = (id?: string) => projects.find(project => project.dredz_project1id === id)?.dredz_pm_name ?? '—'

  async function move(task: Task, status: Status) {
    if (disabled || savingId || task.dredz_pm_status === status || !task._dredz_pm_projectid_value) return
    const previous = tasks
    setTasks(rows => rows?.map(row => row.dredz_task1id === task.dredz_task1id ? { ...row, dredz_pm_status: status } : row) ?? null)
    setSavingId(task.dredz_task1id)
    setMoveError('')
    try { onChanged(await updateTaskStatus(task.dredz_task1id, task._dredz_pm_projectid_value, status)) }
    catch (error) { setTasks(previous); setMoveError(`Could not move the task. ${errorMessage(error)}`) }
    finally { setSavingId('') }
  }

  return <div className="kanban-view">
    <div className="toolbar">
      <label className="inline-field"><span>Project</span>
        <select value={projectFilter} onChange={event => onProjectFilter(event.target.value)}>
          <option value="">All projects</option>
          {projects.map(project => <option key={project.dredz_project1id} value={project.dredz_project1id}>{project.dredz_pm_name}</option>)}
        </select>
      </label>
      <label className="inline-field"><span>Assignee</span>
        <select value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
          <option value="">Everyone</option>
          {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <span className="muted toolbar-hint">Drag a card to change its status</span>
    </div>
    {error && <div className="error" role="alert">Could not load tasks. {error}</div>}
    {moveError && <div className="error" role="alert">{moveError}</div>}
    {!tasks && !error && <p role="status" className="muted">Loading board…</p>}
    {tasks && <div className="kanban">
      {columns.map((status, index) => {
        const items = visible.filter(task => (task.dredz_pm_status ?? choices.notStarted) === status)
        return <section key={status} className={`kanban-column ${overColumn === status ? 'drop-target' : ''}`} aria-label={taskStatuses[status]}
          onDragOver={event => { if (dragId) { event.preventDefault(); setOverColumn(status) } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverColumn(null) }}
          onDrop={event => {
            event.preventDefault()
            const task = tasks.find(row => row.dredz_task1id === dragId)
            setOverColumn(null); setDragId('')
            if (task) void move(task, status)
          }}>
          <header className="kanban-head">
            <span className={`dot tone-bg-${statusToneOf(status)}`} />
            <h2>{taskStatuses[status]}</h2>
            <span className="count">{items.length}</span>
          </header>
          <div className="kanban-cards">
            {!items.length && <p className="kanban-empty">No tasks</p>}
            {items.map(task => {
              const done = task.dredz_pm_status === choices.done
              return <article key={task.dredz_task1id} className={`kanban-card ${dragId === task.dredz_task1id ? 'dragging' : ''} ${savingId === task.dredz_task1id ? 'saving' : ''} ${done ? 'done' : ''}`}
                draggable={!disabled && !savingId} onDragStart={event => { setDragId(task.dredz_task1id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setDragId(''); setOverColumn(null) }}>
                <button className="kanban-title" disabled={disabled} onClick={() => onEdit(task)}>{task.dredz_pm_name}</button>
                {!projectFilter && <p className="kanban-project">{projectName(task._dredz_pm_projectid_value)}</p>}
                <div className="kanban-meta">
                  <PriorityChip priority={task.dredz_pm_priority} />
                  <DueLabel date={task.dredz_pm_duedate} done={done} />
                  <Avatar name={lookupName(lookups.peopleNames, task._dredz_pm_owner_value)} size="sm" />
                </div>
                <div className="kanban-move">
                  <button className="icon-button" disabled={disabled || index === 0 || savingId !== ''} aria-label={`Move “${task.dredz_pm_name}” to: ${taskStatuses[columns[index - 1]] ?? ''}`} onClick={() => void move(task, columns[index - 1])}><Icon name="chevronLeft" size={14} /></button>
                  <button className="icon-button" disabled={disabled || index === columns.length - 1 || savingId !== ''} aria-label={`Move “${task.dredz_pm_name}” to: ${taskStatuses[columns[index + 1]] ?? ''}`} onClick={() => void move(task, columns[index + 1])}><Icon name="chevronRight" size={14} /></button>
                </div>
              </article>
            })}
          </div>
        </section>
      })}
    </div>}
  </div>
}
