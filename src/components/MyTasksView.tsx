import { useState } from 'react'
import { projectInactivityDays, projectStages, taskStatuses } from '../config/dataverse'
import { dateLabel, errorMessage, personName, updateTaskStatus } from '../data/projects'
import type { Lookups, Project, Task, TaskSaved } from '../data/projects'
import { daysSinceActivity, groupMyTasks } from '../data/myTasks'
import { Icon, PriorityChip } from './ui'
import { statusToneOf } from './format'

type Props = {
  projects: Project[]
  tasks: Task[] | null
  tasksError: string
  lookups: Lookups
  personId: string
  personLoading: boolean
  personError: string
  onSelectPerson: (id: string) => void
  onOpenProject: (id: string) => void
  onShowAllProjects: () => void
  onTaskChanged: (result: TaskSaved) => void
}

type TaskStatus = NonNullable<Task['dredz_pm_status']>

const taskStatusOptions = Object.keys(taskStatuses).map(Number) as TaskStatus[]

export function MyTasksView({ projects, tasks, tasksError, lookups, personId, personLoading, personError, onSelectPerson, onOpenProject, onShowAllProjects, onTaskChanged }: Props) {
  const [changingPerson, setChangingPerson] = useState(false)
  const [candidatePersonId, setCandidatePersonId] = useState('')
  const [savingStatusId, setSavingStatusId] = useState('')
  const [statusError, setStatusError] = useState('')
  const person = lookups.peopleNames.find(item => item.id === personId)
  const taskSections = personId && tasks ? groupMyTasks(tasks, projects, personId) : null
  const ownedProjects = personId ? projects.filter(project => project._dredz_pm_owner_value === personId) : []

  async function changeStatus(task: Task, value: string) {
    const projectId = task._dredz_pm_projectid_value
    const status = taskStatusOptions.find(option => option === Number(value))
    if (!projectId || status === undefined || status === task.dredz_pm_status) return
    setSavingStatusId(task.dredz_task1id)
    setStatusError('')
    try {
      onTaskChanged(await updateTaskStatus(task.dredz_task1id, projectId, status))
    } catch (error) {
      setStatusError(`Could not update the task status. ${errorMessage(error)}`)
    } finally {
      setSavingStatusId('')
    }
  }

  function renderTaskSection(title: string, sectionTasks: Task[], overdue = false) {
    if (!sectionTasks.length) return null
    return <section className={`card my-task-section ${overdue ? 'my-task-overdue' : ''}`} key={title}>
      <div className="card-head"><h2>{title}</h2><span className="count">{sectionTasks.length}</span></div>
      <div className="table-scroll"><table>
        <thead><tr><th>Task</th><th>Project</th><th>Due date</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>{sectionTasks.map(task => {
          const project = projects.find(item => item.dredz_project1id === task._dredz_pm_projectid_value)
          return <tr key={task.dredz_task1id}>
            <td>{task.dredz_pm_name}</td>
            <td><button className="link-button" disabled={!project} onClick={() => project && onOpenProject(project.dredz_project1id)}>{project?.dredz_pm_name ?? '—'}</button></td>
            <td>{dateLabel(task.dredz_pm_duedate)}</td>
            <td><PriorityChip priority={task.dredz_pm_priority} /></td>
            <td><select className={`status-select chip-${statusToneOf(task.dredz_pm_status)}`} aria-label={`Status of task ${task.dredz_pm_name}`} value={task.dredz_pm_status ?? ''} disabled={savingStatusId === task.dredz_task1id} onChange={event => { void changeStatus(task, event.target.value) }}>
              {task.dredz_pm_status == null && <option value="">Not set</option>}
              {Object.entries(taskStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></td>
          </tr>
        })}</tbody>
      </table></div>
    </section>
  }

  return <div className="my-tasks-view">
    <section className="card my-person-card">
      {personId && person && !changingPerson
        ? <div className="my-person-current"><span>Tasks for <strong>{personName(person.name)}</strong></span><button className="link-button" onClick={() => { setCandidatePersonId(personId); setChangingPerson(true) }}>Change person</button></div>
        : personLoading && !changingPerson
          ? <p role="status" className="muted">Identifying the signed-in person…</p>
          : <div className="my-person-picker">
            <label>Who are you?
              <select value={candidatePersonId} onChange={event => setCandidatePersonId(event.target.value)}>
                <option value="">Select a person</option>
                {lookups.people.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="actions">
              <button disabled={!candidatePersonId} onClick={() => {
                onSelectPerson(candidatePersonId)
                setChangingPerson(false)
              }}>Use this person</button>
              {personId && <button className="secondary" onClick={() => setChangingPerson(false)}>Cancel</button>}
            </div>
            {!personId && personError && <p className="error" role="alert">{personError}</p>}
            {!personId && !personError && !lookups.people.length && <p className="muted">No active organization users are available to assign.</p>}
          </div>}
    </section>

    {personId && <>
      {statusError && <p className="error" role="alert">{statusError}</p>}
      {tasksError && <p className="error" role="alert">Could not load tasks. {tasksError}</p>}
      {!tasks && !tasksError && <p className="muted" role="status">Loading your tasks…</p>}
      {taskSections && <>
        {Object.values(taskSections).every(section => section.length === 0) && <p className="empty">No open tasks assigned to you.</p>}
        {renderTaskSection('Overdue', taskSections.overdue, true)}
        {renderTaskSection('This week', taskSections.thisWeek)}
        {renderTaskSection('Next week', taskSections.nextWeek)}
        {renderTaskSection('Later', taskSections.later)}
        {renderTaskSection('No due date', taskSections.noDueDate)}
      </>}

      <section className="my-owned-projects">
        <h2>My projects</h2>
        {!ownedProjects.length
          ? <div className="empty project-filter-empty"><p>You don't have any assigned projects yet.</p><button className="secondary" onClick={onShowAllProjects}>Show all projects</button></div>
          : <div className="card table-scroll"><table>
            <thead><tr><th>Project</th><th>Stage</th><th>Last activity</th></tr></thead>
            <tbody>{ownedProjects.map(project => {
              const days = daysSinceActivity(project.dredz_pm_lastactivity)
              return <tr key={project.dredz_project1id}>
                <td>{project.dredz_pm_name}</td>
                <td>{project.dredz_pm_stage == null ? 'Not set' : projectStages[project.dredz_pm_stage] ?? 'Unknown stage'}</td>
                <td>
                  {dateLabel(project.dredz_pm_lastactivity)}
                  {days !== undefined && days > projectInactivityDays && <span className="my-project-stalled"><Icon name="clock" size={14} />No activity for {days} days</span>}
                </td>
              </tr>
            })}</tbody>
          </table></div>}
      </section>
    </>}
  </div>
}
