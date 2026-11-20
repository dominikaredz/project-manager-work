import { useEffect, useState } from 'react'
import { choices, taskStatuses } from '../config/dataverse'
import { deleteTask, errorMessage, loadTasks, lookupName, personName, updateTaskStatus } from '../data/projects'
import type { Option, Task, TaskSaved } from '../data/projects'
import { Avatar, DueLabel, Icon, PriorityChip, StatusChip } from './ui'
import { statusToneOf } from './format'

export function TaskList({ projectId, people, revision, readOnly = false, disabled = false, onEdit, onChanged, onDeleted }: {
  projectId: string; people: Option[]; revision: number; readOnly?: boolean; disabled?: boolean
  onEdit: (task: Task) => void; onChanged: (result: TaskSaved) => void; onDeleted: (result: TaskSaved) => void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [savingStatusId, setSavingStatusId] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    loadTasks(projectId, readOnly).then(rows => {
      if (active) { setTasks(rows); setError(''); setLoading(false) }
    }).catch(error => {
      if (active) { setError(errorMessage(error)); setLoading(false) }
    })
    return () => { active = false }
  }, [projectId, revision, retry, readOnly])
  if (loading) return <p role="status" className="muted">Loading tasks…</p>
  if (error) return <div className="error" role="alert">Could not load tasks. {error}<button className="secondary" onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Try again</button></div>
  if (!tasks.length) return <p className="empty">{readOnly ? 'This project has no tasks.' : 'This project has no active tasks yet.'}</p>
  const completedTasks = tasks.filter(task => task.dredz_pm_status === choices.done)
  const visibleTasks = tasks
    .filter(task => showCompleted || task.dredz_pm_status !== choices.done)
    .sort((left, right) => Number(left.dredz_pm_status === choices.done) - Number(right.dredz_pm_status === choices.done))
  return <>
    {!readOnly && <button className={`toggle-pill ${showCompleted ? 'active' : ''}`} aria-pressed={showCompleted} onClick={() => setShowCompleted(value => !value)}>
      <Icon name="check" size={14} />{showCompleted ? 'Hide completed' : `Show completed (${completedTasks.length})`}
    </button>}
    {deletingTask && <section className="delete-confirmation" role="alertdialog" aria-labelledby="delete-task-confirmation">
      <p id="delete-task-confirmation">Delete task “{deletingTask.dredz_pm_name}”? This action cannot be undone.</p>
      {deleteError && <p className="error" role="alert">{deleteError}</p>}
      <div className="actions">
        <button className="danger-button" disabled={deleting || disabled} onClick={async () => {
          setDeleting(true)
          setDeleteError('')
          try { onDeleted(await deleteTask(deletingTask.dredz_task1id, projectId)) }
          catch (error) { setDeleteError(`Could not delete the task. ${errorMessage(error)}`) }
          finally { setDeleting(false) }
        }}>{deleting ? 'Deleting…' : 'Delete task'}</button>
        <button className="secondary" disabled={deleting} onClick={() => { setDeletingTask(null); setDeleteError('') }}>Cancel</button>
      </div>
    </section>}
    {statusError && <p className="error" role="alert">{statusError}</p>}
    <div className="table-scroll"><table>
      <thead><tr><th>Task</th><th>Assignee</th><th>Due date</th><th>Status</th><th>Priority</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead>
      <tbody>{visibleTasks.map(task => {
        const owner = lookupName(people, task._dredz_pm_owner_value)
        const done = task.dredz_pm_status === choices.done
        return <tr className={done ? 'completed-task' : undefined} key={task.dredz_task1id}>
          <td>{task.dredz_pm_name}</td>
          <td><span className="person-cell"><Avatar name={owner} size="sm" />{owner === '—' ? '—' : personName(owner)}</span></td>
          <td><DueLabel date={task.dredz_pm_duedate} done={done} /></td>
          <td>{readOnly ? <StatusChip status={task.dredz_pm_status} /> : <select className={`status-select chip-${statusToneOf(task.dredz_pm_status)}`} aria-label={`Status of task ${task.dredz_pm_name}`} value={task.dredz_pm_status ?? ''} disabled={disabled || savingStatusId === task.dredz_task1id} onChange={async event => {
            const status = Number(event.target.value)
            const validStatus = Object.keys(taskStatuses).map(Number).find(value => value === status)
            if (validStatus === undefined || validStatus === task.dredz_pm_status) return
            setSavingStatusId(task.dredz_task1id)
            setStatusError('')
            try { onChanged(await updateTaskStatus(task.dredz_task1id, projectId, validStatus as NonNullable<Task['dredz_pm_status']>)) }
            catch (error) { setStatusError(`Could not change the task status. ${errorMessage(error)}`) }
            finally { setSavingStatusId('') }
          }}>
            {task.dredz_pm_status == null && <option value="">Not set</option>}
            {Object.entries(taskStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>}</td>
          <td><PriorityChip priority={task.dredz_pm_priority} /></td>
          {!readOnly && <td><div className="task-actions">
            <button className="icon-button" title="Edit" aria-label={`Edit ${task.dredz_pm_name}`} disabled={disabled} onClick={() => onEdit(task)}><Icon name="edit" size={16} /></button>
            <button className="icon-button danger" title="Delete" aria-label={`Delete ${task.dredz_pm_name}`} disabled={disabled || deleting} onClick={() => { setDeletingTask(task); setDeleteError('') }}><Icon name="trash" size={16} /></button>
          </div></td>}
        </tr>
      })}</tbody>
    </table></div>
  </>
}
