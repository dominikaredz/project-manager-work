import { useEffect, useState } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import { ProjectForm } from './components/ProjectForm'
import { ProjectLifecyclePanel } from './components/ProjectLifecyclePanel'
import { ProjectList } from './components/ProjectList'
import { MyTasksView } from './components/MyTasksView'
import { TaskForm } from './components/TaskForm'
import { TaskList } from './components/TaskList'
import { DictionariesView } from './components/DictionariesView'
import { Dashboard } from './components/Dashboard'
import type { DashboardScope } from './components/Dashboard'
import { KanbanBoard } from './components/KanbanBoard'
import { Icon, Modal } from './components/ui'
import type { IconName } from './components/ui'
import { errorMessage, findSystemUser, loadAllTasks, loadLookups, loadProjects, updateLastActivity } from './data/projects'
import type { Lookups, Project, SignedInIdentity, Task, TaskSaved } from './data/projects'
import { choices, openProjectStages, projectKinds, projectStages } from './config/dataverse'
import { emptyProjectFilters, filterMyProjects, filterProjects, hasProjectFilters, NO_PROJECT_FILTER } from './data/projectFilters'
import type { ProjectFilters } from './data/projectFilters'
import './App.css'

type View = 'dashboard' | 'projects' | 'myTasks' | 'kanban' | 'dictionaries'
type Theme = 'dark' | 'light'
type ProjectScope = 'mine' | 'all'

const tabs: { id: View; label: string; icon: IconName; subtitle: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', subtitle: 'Your projects and tasks at a glance' },
  { id: 'projects', label: 'Projects', icon: 'folder', subtitle: 'Active projects, tasks, and owners' },
  { id: 'myTasks', label: 'My tasks', icon: 'check', subtitle: 'Your tasks and projects' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban', subtitle: 'Tasks across active projects by status' },
  { id: 'dictionaries', label: 'Dictionaries', icon: 'book', subtitle: 'Clients and products' },
]

function projectFilterStorageKey(archived: boolean) {
  return `pm-project-filters-${archived ? 'archive' : 'active'}`
}

function readProjectFilters(archived: boolean): ProjectFilters {
  const defaults = emptyProjectFilters()
  try {
    const saved = localStorage.getItem(projectFilterStorageKey(archived))
    if (!saved) return defaults
    const value = JSON.parse(saved) as Partial<ProjectFilters>
    return {
      search: typeof value.search === 'string' ? value.search : defaults.search,
      stage: typeof value.stage === 'string' ? value.stage : defaults.stage,
      kind: typeof value.kind === 'string' ? value.kind : defaults.kind,
      clientId: typeof value.clientId === 'string' ? value.clientId : defaults.clientId,
      productId: typeof value.productId === 'string' ? value.productId : defaults.productId,
      ownerId: typeof value.ownerId === 'string' ? value.ownerId : defaults.ownerId,
    }
  } catch {
    return defaults
  }
}

function saveProjectFilters(archived: boolean, filters: ProjectFilters) {
  try { localStorage.setItem(projectFilterStorageKey(archived), JSON.stringify(filters)) } catch { /* Browser storage is unavailable. */ }
}

function initialProjectScope(): ProjectScope {
  try { return localStorage.getItem('pm-project-scope') === 'all' ? 'all' : 'mine' } catch { return 'mine' }
}

function initialSystemUserId() {
  try { return localStorage.getItem('pm-systemuser-id') ?? '' } catch { return '' }
}

function initialTheme(): Theme {
  try { return localStorage.getItem('pm-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [projects, setProjects] = useState<Project[]>([])
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [kanbanProject, setKanbanProject] = useState('')
  const [form, setForm] = useState<'project' | 'task' | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskProjectId, setTaskProjectId] = useState('')
  const [archived, setArchived] = useState(false)
  const [projectFilters, setProjectFilters] = useState(() => readProjectFilters(false))
  const [projectScope, setProjectScope] = useState<ProjectScope>(initialProjectScope)
  // Pulpit zawsze startuje od projektów zalogowanej osoby; wybór „Wszystkie” obowiązuje tylko w bieżącej sesji.
  const [dashboardScope, setDashboardScope] = useState<DashboardScope>('mine')
  const [preferredSystemUserId, setPreferredSystemUserId] = useState(initialSystemUserId)
  const [taskLoad, setTaskLoad] = useState<{ revision: number; tasks: Task[] | null; error: string }>({ revision: -1, tasks: null, error: '' })
  const [signedInAccount, setSignedInAccount] = useState<{ status: 'loading' | 'ready' | 'error'; identity: SignedInIdentity | null; error: string }>({ status: 'loading', identity: null, error: '' })
  const [lifecycle, setLifecycle] = useState<{ mode: 'close' | 'restore'; project: Project } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [taskRevision, setTaskRevision] = useState(0)
  const [pendingActivity, setPendingActivity] = useState<TaskSaved | null>(null)
  const [retryingActivity, setRetryingActivity] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('pm-theme', theme) } catch { /* Browser storage is unavailable. */ }
  }, [theme])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let active = true
    Promise.all([loadProjects(archived), loadLookups()]).then(([rows, options]) => {
      if (!active) return
      setProjects(rows)
      setLookups(options)
      setSelectedId(previous => rows.some(row => row.dredz_project1id === previous) ? previous : rows[0]?.dredz_project1id ?? '')
      setError('')
      setLoading(false)
    }).catch(error => {
      if (active) { setError(errorMessage(error)); setLoading(false) }
    })
    return () => { active = false }
  }, [revision, archived])

  useEffect(() => {
    let active = true
    loadAllTasks().then(rows => {
      if (active) setTaskLoad({ revision, tasks: rows, error: '' })
    }).catch(error => {
      if (active) setTaskLoad({ revision, tasks: null, error: errorMessage(error) })
    })
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    let active = true
    getContext().then(context => {
      if (!active) return
      const identity: SignedInIdentity = {
        systemUserId: context.user.systemUserId?.trim(),
        objectId: context.user.objectId?.trim(),
        userPrincipalName: context.user.userPrincipalName?.trim(),
      }
      if (!identity.systemUserId && !identity.objectId && !identity.userPrincipalName) {
        setSignedInAccount({ status: 'error', identity: null, error: 'Could not read the signed-in account identity.' })
      } else setSignedInAccount({ status: 'ready', identity, error: '' })
    }).catch(error => {
      if (active) setSignedInAccount({ status: 'error', identity: null, error: `Could not identify the signed-in user. ${errorMessage(error)}` })
    })
    return () => { active = false }
  }, [])

  const activeTasks = taskLoad.revision === revision ? taskLoad.tasks : null
  const activeTasksError = taskLoad.revision === revision ? taskLoad.error : ''
  const preferredSystemUserExists = Boolean(lookups?.peopleNames.some(person => person.id === preferredSystemUserId))
  const accountSystemUser = signedInAccount.status === 'ready'
    ? findSystemUser(lookups?.peopleNames ?? [], signedInAccount.identity ?? undefined)
    : undefined
  const currentPersonLoading = !preferredSystemUserExists && (!lookups || signedInAccount.status === 'loading')
  const currentPersonId = preferredSystemUserExists ? preferredSystemUserId : accountSystemUser?.id ?? ''
  const currentPersonError = preferredSystemUserExists
    ? ''
    : signedInAccount.status === 'error'
      ? signedInAccount.error
      : signedInAccount.status === 'ready' && !accountSystemUser
        ? 'The signed-in account was not found in the user list.'
        : ''
  const myProjectsLoading = currentPersonLoading || (activeTasks === null && !activeTasksError)
  const myProjectsError = currentPersonError || activeTasksError
  const scopedProjects = projectScope === 'all'
    ? projects
    : myProjectsError ? [] : filterMyProjects(projects, currentPersonId, activeTasks ?? [])
  const filteredProjects = lookups ? filterProjects(scopedProjects, projectFilters, lookups) : scopedProjects
  const selectedProject = filteredProjects.find(project => project.dredz_project1id === selectedId)
  const filtersActive = hasProjectFilters(projectFilters)
  const busy = form !== null || lifecycle !== null
  const tab = tabs.find(item => item.id === view)!

  function refresh() { setLoading(true); setRevision(value => value + 1) }
  function changeArchiveView(value: boolean) {
    if (value === archived) return
    setArchived(value)
    setProjectFilters(readProjectFilters(value))
  }
  function showArchive(value: boolean) {
    if (value === archived) return
    setLoading(true); changeArchiveView(value); setSelectedId(''); setLifecycle(null)
  }
  function updateProjectFilter<K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) {
    const next = { ...projectFilters, [key]: value }
    setProjectFilters(next)
    saveProjectFilters(archived, next)
  }
  function clearProjectFilters() {
    const next = emptyProjectFilters()
    setProjectFilters(next)
    saveProjectFilters(archived, next)
  }
  function changeProjectScope(value: ProjectScope) {
    setProjectScope(value)
    try { localStorage.setItem('pm-project-scope', value) } catch { /* Browser storage is unavailable. */ }
  }
  function changeSystemUser(id: string) {
    setPreferredSystemUserId(id)
    try { localStorage.setItem('pm-systemuser-id', id) } catch { /* Browser storage is unavailable. */ }
  }
  function navigate(next: View) {
    setView(next)
    if (next === 'projects') refresh()
    else showArchive(false)
  }
  function closeForm() { setForm(null); setEditingProject(null); setEditingTask(null) }
  function openNewProject() {
    setNotice(''); showArchive(false); setEditingProject(null); setEditingTask(null); setLifecycle(null); setForm('project')
  }
  function openNewTask(projectId: string) {
    setNotice(''); setEditingTask(null); setEditingProject(null); setTaskProjectId(projectId); setForm('task')
  }
  function openEditTask(task: Task) {
    setEditingTask(task); setEditingProject(null); setNotice(''); setTaskProjectId(task._dredz_pm_projectid_value ?? ''); setForm('task')
  }
  function taskSaved(result: TaskSaved, successMessage: string) {
    setForm(null)
    setEditingTask(null)
    setSelectedId(result.projectId)
    setPendingActivity(result.activityError ? result : null)
    setNotice(result.activityError ? '' : successMessage)
    setTaskRevision(value => value + 1)
    refresh()
  }

  const projectListLoading = loading || (projectScope === 'mine' && myProjectsLoading)
  const canAddTask = !archived && !busy && pendingActivity === null && !!lookups && projects.length > 0
  const projectOptions = projects.map(project => ({ id: project.dredz_project1id, name: project.dredz_pm_name }))

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">P</span><span className="brand-name">Projects<small>Work management</small></span></div>
      <nav className="nav" aria-label="Application tabs">
        {tabs.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined} disabled={busy} onClick={() => navigate(item.id)}>
          <Icon name={item.icon} size={19} /><span>{item.label}</span>
        </button>)}
      </nav>
      <button className="nav-item theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>
    </aside>

    <main className="content">
      <header className="topbar">
        <div><h1>{tab.label}</h1><p className="muted">{view === 'dashboard' ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) : tab.subtitle}</p></div>
        <div className="actions">
          {view !== 'dictionaries' && <button className="icon-button bordered" title="Refresh" aria-label="Refresh" disabled={loading || busy} onClick={() => { refresh(); setTaskRevision(value => value + 1) }}><Icon name="refresh" /></button>}
          {view === 'kanban' && <button disabled={!canAddTask} onClick={() => openNewTask(kanbanProject)}><Icon name="plus" size={16} />New task</button>}
          {(view === 'dashboard' || view === 'projects') && <button disabled={loading || !lookups || busy} onClick={openNewProject}><Icon name="plus" size={16} />New project</button>}
        </div>
      </header>

      {notice && <div className="toast" role="status"><Icon name="check" size={16} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="x" size={14} /></button></div>}
      {pendingActivity && <div className="error" role="alert">
        The task change was saved, but the project's last activity could not be updated. Do not save the task again.
        <p>{pendingActivity.activityError}</p>
        <button disabled={retryingActivity} onClick={async () => {
          setRetryingActivity(true)
          try {
            await updateLastActivity(pendingActivity.projectId, pendingActivity.activityDate)
            setPendingActivity(null)
            setNotice("The project's last activity was updated.")
            refresh()
          } catch (error) { setPendingActivity({ ...pendingActivity, activityError: errorMessage(error) }) }
          finally { setRetryingActivity(false) }
        }}>{retryingActivity ? 'Updating…' : 'Retry date update only'}</button>
      </div>}
      {view !== 'dictionaries' && error && <div className="error" role="alert">Could not load data. {error}<button className="secondary" onClick={refresh}>Try again</button></div>}
      {view !== 'dictionaries' && !lookups && loading && <p role="status" className="muted">Loading projects and options…</p>}

      {view === 'dictionaries' && <DictionariesView />}

      {view === 'dashboard' && lookups && !archived && <Dashboard projects={projects} tasks={activeTasks} tasksError={activeTasksError} lookups={lookups}
        scope={dashboardScope} onScope={setDashboardScope}
        personId={currentPersonId} personLoading={currentPersonLoading} personError={currentPersonError} onSelectPerson={changeSystemUser}
        onOpenProject={id => { changeProjectScope(dashboardScope); setView('projects'); if (id) setSelectedId(id) }} onOpenKanban={projectId => { setKanbanProject(projectId ?? ''); setView('kanban') }}
        onTaskChanged={result => taskSaved(result, 'Task status updated.')} />}

      {view === 'myTasks' && lookups && <MyTasksView projects={projects} tasks={activeTasks} tasksError={activeTasksError} lookups={lookups}
        personId={currentPersonId} personLoading={currentPersonLoading} personError={currentPersonError} onSelectPerson={changeSystemUser}
        onOpenProject={id => { showArchive(false); setSelectedId(id); setView('projects'); refresh() }}
        onShowAllProjects={() => { changeProjectScope('all'); navigate('projects') }}
        onTaskChanged={result => taskSaved(result, 'Task status updated.')} />}

      {view === 'kanban' && lookups && !archived && <KanbanBoard projects={projects} lookups={lookups} revision={taskRevision}
        projectFilter={kanbanProject} onProjectFilter={setKanbanProject} disabled={busy || pendingActivity !== null}
        onEdit={openEditTask} onChanged={result => taskSaved(result, 'Task status updated.')} />}

      {view === 'projects' && lookups && <div className="workspace">
        <section className="card projects-panel">
          <div className="card-head">
            <div className="segmented" role="group" aria-label="Project view">
              <button className={archived ? '' : 'active'} aria-pressed={!archived} disabled={busy} onClick={() => showArchive(false)}>Active</button>
              <button className={archived ? 'active' : ''} aria-pressed={archived} disabled={busy} onClick={() => showArchive(true)}>Archive</button>
            </div>
            <span className="count">{projectListLoading ? '…' : `Projects: ${filteredProjects.length} of ${scopedProjects.length}`}</span>
          </div>
          <div className="segmented project-scope" role="group" aria-label="Project scope">
            <button className={projectScope === 'mine' ? 'active' : ''} aria-pressed={projectScope === 'mine'} onClick={() => changeProjectScope('mine')}>My projects</button>
            <button className={projectScope === 'all' ? 'active' : ''} aria-pressed={projectScope === 'all'} onClick={() => changeProjectScope('all')}>All projects</button>
          </div>
          <div className="project-filters">
            <input className="project-filter-search" type="search" aria-label="Search projects" placeholder="Search projects…" value={projectFilters.search} onChange={event => updateProjectFilter('search', event.target.value)} />
            <select aria-label="Filter by stage" value={projectFilters.stage} onChange={event => updateProjectFilter('stage', event.target.value)}>
              <option value="">All stages</option>
              {Object.entries(archived ? {
                [choices.completed]: projectStages[choices.completed],
                [choices.lost]: projectStages[choices.lost],
              } : openProjectStages).map(([stage, label]) => <option key={stage} value={stage}>{label}</option>)}
            </select>
            <select aria-label="Filter by type" value={projectFilters.kind} onChange={event => updateProjectFilter('kind', event.target.value)}>
              <option value="">All types</option>
              {Object.entries(projectKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
            <select aria-label="Filter by client" value={projectFilters.clientId} onChange={event => updateProjectFilter('clientId', event.target.value)}>
              <option value="">All clients</option>
              <option value={NO_PROJECT_FILTER}>No client</option>
              {lookups?.clientNames.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <select aria-label="Filter by product" value={projectFilters.productId} onChange={event => updateProjectFilter('productId', event.target.value)}>
              <option value="">All products</option>
              {lookups?.productNames.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select aria-label="Filter by owner" value={projectFilters.ownerId} onChange={event => updateProjectFilter('ownerId', event.target.value)}>
              <option value="">All owners</option>
              <option value={NO_PROJECT_FILTER}>No owner</option>
              {lookups?.peopleNames.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            {filtersActive && (loading || filteredProjects.length > 0) && <button className="secondary project-clear-filters" onClick={clearProjectFilters}>Clear filters</button>}
          </div>
          {projectListLoading ? <p role="status" className="muted">Loading projects…</p>
            : projectScope === 'mine' && myProjectsError
              ? <div className="error project-filter-empty" role="alert">{myProjectsError}<button className="secondary" onClick={() => changeProjectScope('all')}>Show all projects</button></div>
              : projectScope === 'mine' && scopedProjects.length === 0
                ? <div className="empty project-filter-empty"><p>You don't have any assigned projects yet.</p><button className="secondary" onClick={() => changeProjectScope('all')}>Show all projects</button></div>
                : filteredProjects.length === 0 && filtersActive
                  ? <div className="empty project-filter-empty"><p>No projects match the criteria.</p><button className="secondary" onClick={clearProjectFilters}>Clear filters</button></div>
                  : <ProjectList projects={filteredProjects} lookups={lookups} selectedId={selectedId} archived={archived} disabled={busy}
              onSelect={id => { setSelectedId(id); closeForm(); setLifecycle(null) }}
              onEdit={project => { setSelectedId(project.dredz_project1id); setEditingProject(project); setEditingTask(null); setNotice(''); setForm('project') }}
              onClose={project => { setLifecycle({ mode: 'close', project }); setNotice('') }}
              onRestore={project => { setLifecycle({ mode: 'restore', project }); setNotice('') }} />}
        </section>
        <section className="card tasks-panel" aria-label="Zadania projektu">
          <div className="card-head">
            <div><p className="eyebrow">{archived ? 'Archive · tasks' : 'Project tasks'}</p><h2>{selectedProject?.dredz_pm_name ?? 'Select a project'}</h2></div>
            {!archived && <button disabled={!selectedProject || !canAddTask} onClick={() => openNewTask(selectedId)}><Icon name="plus" size={16} />New task</button>}
          </div>
          {selectedProject && !loading
            ? <TaskList key={`${selectedId}-${archived}`} projectId={selectedId} people={lookups.peopleNames} revision={taskRevision} readOnly={archived} disabled={busy || pendingActivity !== null}
              onEdit={openEditTask} onChanged={result => taskSaved(result, 'Task status updated.')} onDeleted={result => taskSaved(result, 'Task deleted.')} />
            : <p className="empty">Select a project to view its tasks.</p>}
        </section>
      </div>}
    </main>

    {lifecycle && <Modal onClose={() => setLifecycle(null)}>
      <ProjectLifecyclePanel key={`${lifecycle.mode}-${lifecycle.project.dredz_project1id}`} mode={lifecycle.mode} project={lifecycle.project} onCancel={() => setLifecycle(null)} onSaved={() => {
        const { mode, project } = lifecycle
        setLifecycle(null)
        changeArchiveView(mode === 'close')
        setSelectedId(project.dredz_project1id)
        setNotice(mode === 'close' ? 'Project closed and moved to the archive.' : 'Project restored.')
        refresh()
      }} />
    </Modal>}
    {lookups && form === 'project' && <Modal onClose={closeForm}>
      <ProjectForm lookups={lookups} project={editingProject ?? undefined} onCancel={closeForm} onSaved={closed => {
        setForm(null)
        changeArchiveView(closed)
        if (editingProject) setSelectedId(editingProject.dredz_project1id)
        setNotice(closed ? 'Project closed and moved to the archive.' : editingProject ? 'Project updated.' : 'Project created.')
        setEditingProject(null)
        refresh()
      }} />
    </Modal>}
    {lookups && form === 'task' && <Modal onClose={closeForm}>
      <TaskForm lookups={lookups} projectId={taskProjectId} projects={taskProjectId ? undefined : projectOptions} task={editingTask ?? undefined} onCancel={closeForm}
        onSaved={result => taskSaved(result, editingTask ? 'Task updated.' : 'Task created.')} />
    </Modal>}
  </div>
}

export default App
