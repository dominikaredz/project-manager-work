import { useEffect, useRef, useState } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import { choices, taskPriorities, taskStatuses } from '../config/dataverse'
import { createTask, errorMessage, findSystemUser, updateTask } from '../data/projects'
import type { Lookups, Option, Task, TaskInput, TaskSaved } from '../data/projects'
import { ChoiceField, LookupField } from './FormFields'

export function TaskForm({ lookups, projectId, projects, task, onSaved, onCancel }: {
  lookups: Lookups; projectId: string; projects?: Option[]; task?: Task; onSaved: (result: TaskSaved) => void; onCancel: () => void
}) {
  const [input, setInput] = useState<TaskInput>(() => task ? {
    name: task.dredz_pm_name,
    projectId: task._dredz_pm_projectid_value ?? projectId,
    ownerId: task._dredz_pm_owner_value ?? '',
    requestedById: task._dredz_pm_requestedby_value ?? '',
    dueDate: task.dredz_pm_duedate?.slice(0, 10) ?? '',
    status: task.dredz_pm_status ?? choices.notStarted,
    priority: task.dredz_pm_priority ?? choices.medium,
    description: task.dredz_pm_description ?? '',
    estimatedHours: task.dredz_pm_estimatedhours == null ? '' : String(task.dredz_pm_estimatedhours),
  } : {
    name: '', projectId, ownerId: '', requestedById: '', dueDate: '', status: choices.notStarted,
    priority: choices.medium, description: '', estimatedHours: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requesterNotice, setRequesterNotice] = useState('')
  const requesterManuallyChanged = useRef(false)
  const activePeople = lookups.people
  const selectedOwnerHidden = Boolean(task && input.ownerId === task._dredz_pm_owner_value && !activePeople.some(person => person.id === input.ownerId))
  const selectedRequesterHidden = Boolean(task && input.requestedById === task._dredz_pm_requestedby_value && !activePeople.some(person => person.id === input.requestedById))
  const hiddenOwnerName = lookups.peopleNames.find(person => person.id === input.ownerId)?.name
  const hiddenRequesterName = lookups.peopleNames.find(person => person.id === input.requestedById)?.name
  function change<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setInput(previous => ({ ...previous, [key]: value }))
  }
  useEffect(() => {
    if (task) return
    let active = true
    getContext().then(context => {
      if (!active || requesterManuallyChanged.current) return
      const requester = findSystemUser(lookups.people, context.user)
      if (requester) {
        setInput(previous => ({ ...previous, requestedById: requester.id }))
        setRequesterNotice('')
      } else {
        setRequesterNotice('The signed-in account was not found in the user list. You can select the requester manually.')
      }
    }).catch(error => {
      if (active) setRequesterNotice(`Could not determine the requester. ${errorMessage(error)}`)
    })
    return () => { active = false }
  }, [lookups.people, task])
  return <section className="panel form-panel" aria-labelledby="task-form-title">
    <h2 id="task-form-title">{task ? 'Edit task' : 'New task'}</h2>
    <form onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      setSaving(true)
      setError('')
      try { onSaved(await (task ? updateTask(task.dredz_task1id, input) : createTask(input))) }
      catch (error) { setError(`Could not ${task ? 'save' : 'create'} the task. ${errorMessage(error)}`) }
      finally { setSaving(false) }
    }}>
      <fieldset disabled={saving}>
        <div className="form-grid">
          <label className="wide">Task name *<input autoFocus required value={input.name} onChange={event => change('name', event.target.value)} /></label>
          {!task && projects && <LookupField label="Project" required value={input.projectId} options={projects} onChange={value => change('projectId', value)} />}
          <div className="lookup-create-field">
            {selectedOwnerHidden && <p className="muted">Current assignee: {hiddenOwnerName ?? 'not available in the active user list'} (hidden)</p>}
            <LookupField label="Assignee" value={selectedOwnerHidden ? '' : input.ownerId} options={activePeople} onChange={value => change('ownerId', value)} />
          </div>
          <label>Due date<input type="date" value={input.dueDate} onChange={event => change('dueDate', event.target.value)} /></label>
          <ChoiceField label="Priority" value={input.priority} labels={taskPriorities} onChange={value => change('priority', value)} />
        </div>
        <details><summary>More fields</summary><div className="form-grid">
          <div className="lookup-create-field">
            {selectedRequesterHidden && <p className="muted">Current requester: {hiddenRequesterName ?? 'not available in the active user list'} (hidden)</p>}
            <LookupField label="Requester" value={selectedRequesterHidden ? '' : input.requestedById} options={activePeople} onChange={value => {
              requesterManuallyChanged.current = true
              setRequesterNotice('')
              change('requestedById', value)
            }} />
          </div>
          {requesterNotice && <p className="wide muted" role="status">{requesterNotice}</p>}
          <ChoiceField label="Status" value={input.status} labels={taskStatuses} onChange={value => change('status', value)} />
          <label>Estimated hours<input type="number" min="0" step="0.25" value={input.estimatedHours} onChange={event => change('estimatedHours', event.target.value)} /></label>
          <label className="wide">Description<textarea rows={3} value={input.description} onChange={event => change('description', event.target.value)} /></label>
        </div></details>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button type="submit">{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></div>
      </fieldset>
    </form>
  </section>
}
