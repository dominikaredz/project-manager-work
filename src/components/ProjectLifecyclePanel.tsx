import { useEffect, useState } from 'react'
import { choices, openProjectStages, projectStages } from '../config/dataverse'
import { closeProject, countIncompleteTasks, errorMessage, restoreProject } from '../data/projects'
import type { Project, ProjectInput } from '../data/projects'
import { ChoiceField } from './FormFields'

function incompleteTaskLabel(count: number) {
  return `${count} unfinished ${count === 1 ? 'task' : 'tasks'}`
}

export function ProjectLifecyclePanel({ mode, project, onCancel, onSaved }: {
  mode: 'close' | 'restore'; project: Project; onCancel: () => void; onSaved: () => void
}) {
  const [stage, setStage] = useState<ProjectInput['stage']>(mode === 'close' ? choices.completed : choices.lead)
  const [incompleteCount, setIncompleteCount] = useState<number | null>(null)
  const [countError, setCountError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'close') return
    let active = true
    countIncompleteTasks(project.dredz_project1id).then(count => {
      if (active) setIncompleteCount(count)
    }).catch(error => {
      if (active) setCountError(errorMessage(error))
    })
    return () => { active = false }
  }, [mode, project.dredz_project1id])

  const stages = mode === 'close' ? {
    [choices.completed]: projectStages[choices.completed],
    [choices.lost]: projectStages[choices.lost],
  } : openProjectStages

  return <section className="panel form-panel lifecycle-panel" aria-labelledby="lifecycle-title">
    <h2 id="lifecycle-title">{mode === 'close' ? 'Close project' : 'Restore project'}</h2>
    <p>{project.dredz_pm_name}</p>
    <ChoiceField label="Stage" value={stage} labels={stages} onChange={setStage} />
    {mode === 'close' && incompleteCount === null && !countError && <p role="status">Checking tasks…</p>}
    {mode === 'close' && countError && <p className="error" role="alert">Could not check tasks. {countError}</p>}
    {mode === 'close' && incompleteCount !== null && incompleteCount > 0 && <p className="warning">
      The project has {incompleteTaskLabel(incompleteCount)}. They will remain in the archive with the project.
    </p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
      <button disabled={saving || (mode === 'close' && (incompleteCount === null || Boolean(countError)))} onClick={async () => {
        setSaving(true)
        setError('')
        try {
          if (mode === 'close') await closeProject(project.dredz_project1id, stage)
          else await restoreProject(project.dredz_project1id, stage)
          onSaved()
        } catch (error) {
          setError(`Could not ${mode === 'close' ? 'close' : 'restore'} the project. ${errorMessage(error)}`)
        } finally { setSaving(false) }
      }}>{saving ? 'Saving…' : 'Confirm'}</button>
      <button type="button" className="secondary" disabled={saving} onClick={onCancel}>Cancel</button>
    </div>
  </section>
}
