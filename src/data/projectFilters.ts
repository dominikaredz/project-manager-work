import { choices } from '../config/dataverse'
import type { Lookups, Project, Task } from './projects'

export const NO_PROJECT_FILTER = '__none__'

export type ProjectFilters = {
  search: string
  stage: string
  kind: string
  clientId: string
  productId: string
  ownerId: string
}

export function emptyProjectFilters(): ProjectFilters {
  return { search: '', stage: '', kind: '', clientId: '', productId: '', ownerId: '' }
}

export function hasProjectFilters(filters: ProjectFilters) {
  return Object.values(filters).some(value => value.trim() !== '')
}

export function normalizeProjectSearch(value: string) {
  return value.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function filterProjects(projects: Project[], filters: ProjectFilters, lookups: Lookups) {
  const search = normalizeProjectSearch(filters.search)
  return projects.filter(project => {
    if (filters.stage && String(project.dredz_pm_stage ?? '') !== filters.stage) return false
    if (filters.kind && String(project.dredz_pm_kind ?? '') !== filters.kind) return false

    const clientId = project._dredz_pm_clientid_value ?? ''
    if (filters.clientId === NO_PROJECT_FILTER ? clientId !== '' : filters.clientId && clientId !== filters.clientId) return false

    const productId = project._dredz_pm_productid_value ?? ''
    if (filters.productId && productId !== filters.productId) return false

    const ownerId = project._dredz_pm_owner_value ?? ''
    if (filters.ownerId === NO_PROJECT_FILTER ? ownerId !== '' : filters.ownerId && ownerId !== filters.ownerId) return false

    if (search) {
      const clientName = lookups.clientNames.find(option => option.id === clientId)?.name ?? ''
      const searchableText = normalizeProjectSearch(`${project.dredz_pm_name} ${clientName}`)
      if (!searchableText.includes(search)) return false
    }

    return true
  })
}

export function filterMyProjects(projects: Project[], personId: string, activeTasks: Task[]) {
  if (!personId) return []
  const projectIdsWithAssignedTasks = new Set(
    activeTasks
      .filter(task => task._dredz_pm_owner_value === personId && task.dredz_pm_status !== choices.done)
      .map(task => task._dredz_pm_projectid_value)
      .filter((id): id is string => Boolean(id)),
  )
  return projects.filter(project =>
    project._dredz_pm_owner_value === personId || projectIdsWithAssignedTasks.has(project.dredz_project1id),
  )
}
