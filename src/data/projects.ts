import type { IOperationResult } from '@microsoft/power-apps/data'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import type { Dredz_project1s, Dredz_project1sBase } from '../generated/models/Dredz_project1sModel'
import type { Dredz_task1s, Dredz_task1sBase } from '../generated/models/Dredz_task1sModel'
import { Dredz_project1sService } from '../generated/services/Dredz_project1sService'
import { Dredz_task1sService } from '../generated/services/Dredz_task1sService'
import { Dredz_clientsService } from '../generated/services/Dredz_clientsService'
import { Dredz_productsService } from '../generated/services/Dredz_productsService'
import { SystemusersService } from '../generated/services/SystemusersService'
import { TransactioncurrenciesService } from '../generated/services/TransactioncurrenciesService'
import { choices, entitySets, navigation, openProjectStages, projectStateCodes, projectStatusCodes } from '../config/dataverse'

export type Project = Pick<Dredz_project1s, 'dredz_project1id' | 'dredz_pm_name' | 'dredz_pm_kind' | 'dredz_pm_stage' | 'dredz_pm_enddate' | 'dredz_pm_startdate' | 'dredz_pm_description' | 'dredz_pm_value' | 'dredz_pm_lastactivity' | 'dredz_pm_pinned' | 'statecode' | 'statuscode' | '_dredz_pm_clientid_value' | '_dredz_pm_productid_value' | '_dredz_pm_owner_value' | '_transactioncurrencyid_value'>
export type Task = Pick<Dredz_task1s, 'dredz_task1id' | 'dredz_pm_name' | 'dredz_pm_duedate' | 'dredz_pm_status' | 'dredz_pm_priority' | 'dredz_pm_description' | 'dredz_pm_estimatedhours' | '_dredz_pm_owner_value' | '_dredz_pm_requestedby_value' | '_dredz_pm_projectid_value'>
export type Option = { id: string; name: string; email?: string; azureObjectId?: string }
export type SignedInIdentity = { systemUserId?: string; objectId?: string; userPrincipalName?: string }
export type Lookups = {
  clients: Option[]; products: Option[]; people: Option[]; currencies: Option[]
  clientNames: Option[]; productNames: Option[]; peopleNames: Option[]
}
export type ProjectInput = {
  name: string; kind: NonNullable<Dredz_project1sBase['dredz_pm_kind']>
  clientId: string; productId: string; ownerId: string
  stage: NonNullable<Dredz_project1sBase['dredz_pm_stage']>
  endDate: string; startDate: string; description: string; pinned: boolean
  value: string; currencyId: string
}
export type TaskInput = {
  name: string; projectId: string; ownerId: string; requestedById: string
  dueDate: string; status: NonNullable<Dredz_task1sBase['dredz_pm_status']>
  priority: NonNullable<Dredz_task1sBase['dredz_pm_priority']>
  description: string; estimatedHours: string
}
export type TaskSaved = { projectId: string; activityDate: string; activityError?: string }

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return typeof error === 'string' ? error : 'Unknown error. Please try again.'
}

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) throw result.error ?? new Error('Dataverse did not confirm the operation.')
  return result.data
}

async function allPages<T>(getPage: (options: IGetAllOptions) => Promise<IOperationResult<T[]>>, options: IGetAllOptions) {
  const rows: T[] = []
  let skipToken: string | undefined
  do {
    const result = await getPage({ ...options, skipToken })
    rows.push(...unwrap(result))
    skipToken = result.skipToken
  } while (skipToken)
  return rows
}

function bind(entitySet: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('The selected record ID is invalid.')
  }
  return `/${entitySet}(${id})`
}

export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat('en-GB').format(new Date(`${value.slice(0, 10)}T12:00:00`)) : '—'
}

export function personName(name: string) {
  return name.replace(/\s*\([^)]*@[^)]*\)\s*$/, '')
}

export function initials(name: string) {
  const parts = personName(name).trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function daysUntil(value?: string) {
  if (!value) return undefined
  const due = new Date(`${value.slice(0, 10)}T12:00:00`).getTime()
  const now = new Date(`${today()}T12:00:00`).getTime()
  return Math.round((due - now) / 86400000)
}

export function lookupName(options: Option[], id?: string) {
  return id ? options.find(option => option.id === id)?.name ?? 'Record not in the active list' : '—'
}

export function findSystemUser(users: Option[], identity?: SignedInIdentity) {
  const systemUserId = identity?.systemUserId?.trim().toLowerCase()
  if (systemUserId) {
    const user = users.find(option => option.id.toLowerCase() === systemUserId)
    if (user) return user
  }
  const objectId = identity?.objectId?.trim().toLowerCase()
  if (objectId) {
    const user = users.find(option => option.azureObjectId?.trim().toLowerCase() === objectId)
    if (user) return user
  }
  const email = identity?.userPrincipalName?.trim().toLowerCase()
  return email ? users.find(option => option.email?.trim().toLowerCase() === email) : undefined
}

export function loadProjects(archived = false) {
  return allPages<Project>(options => Dredz_project1sService.getAll<Project>(options), {
    select: ['dredz_project1id', 'dredz_pm_name', 'dredz_pm_kind', 'dredz_pm_stage', 'dredz_pm_enddate', 'dredz_pm_startdate', 'dredz_pm_description', 'dredz_pm_value', 'dredz_pm_lastactivity', 'dredz_pm_pinned', 'statecode', 'statuscode', '_dredz_pm_clientid_value', '_dredz_pm_productid_value', '_dredz_pm_owner_value', '_transactioncurrencyid_value'],
    filter: archived
      ? `statecode eq ${projectStateCodes.inactive}`
      : `statecode eq ${projectStateCodes.active} and (dredz_pm_stage eq null or (dredz_pm_stage ne ${choices.completed} and dredz_pm_stage ne ${choices.lost}))`,
    orderBy: archived ? ['dredz_pm_lastactivity desc', 'dredz_pm_name asc'] : ['dredz_pm_pinned desc', 'dredz_pm_name asc'],
  })
}

export async function countIncompleteTasks(projectId: string) {
  bind(entitySets.project, projectId)
  const tasks = await allPages<Pick<Dredz_task1s, 'dredz_task1id'>>(options => Dredz_task1sService.getAll<Pick<Dredz_task1s, 'dredz_task1id'>>(options), {
    select: ['dredz_task1id'],
    filter: `_dredz_pm_projectid_value eq ${projectId} and (dredz_pm_status eq null or dredz_pm_status ne ${choices.done})`,
  })
  return tasks.length
}

const taskSelect = ['dredz_task1id', 'dredz_pm_name', 'dredz_pm_duedate', 'dredz_pm_status', 'dredz_pm_priority', 'dredz_pm_description', 'dredz_pm_estimatedhours', '_dredz_pm_owner_value', '_dredz_pm_requestedby_value', '_dredz_pm_projectid_value']

export function loadAllTasks() {
  return allPages<Task>(options => Dredz_task1sService.getAll<Task>(options), {
    select: taskSelect,
    filter: 'statecode eq 0',
    orderBy: ['dredz_pm_duedate asc', 'dredz_pm_name asc'],
  })
}

export function loadTasks(projectId: string, includeInactive = false) {
  bind(entitySets.project, projectId)
  return allPages<Task>(options => Dredz_task1sService.getAll<Task>(options), {
    select: taskSelect,
    filter: `${includeInactive ? '' : 'statecode eq 0 and '}_dredz_pm_projectid_value eq ${projectId}`,
    orderBy: ['dredz_pm_duedate asc', 'dredz_pm_name asc'],
  })
}

export async function loadLookups(): Promise<Lookups> {
  const [clients, products, people, currencies] = await Promise.all([
    allPages(options => Dredz_clientsService.getAll<Pick<import('../generated/models/Dredz_clientsModel').Dredz_clients, 'dredz_clientid' | 'dredz_pm_name' | 'statecode'>>(options), { select: ['dredz_clientid', 'dredz_pm_name', 'statecode'], orderBy: ['dredz_pm_name asc'] }),
    allPages(options => Dredz_productsService.getAll<Pick<import('../generated/models/Dredz_productsModel').Dredz_products, 'dredz_productid' | 'dredz_pm_name' | 'statecode'>>(options), { select: ['dredz_productid', 'dredz_pm_name', 'statecode'], orderBy: ['dredz_pm_name asc'] }),
    allPages(options => SystemusersService.getAll<Pick<import('../generated/models/SystemusersModel').Systemusers, 'systemuserid' | 'fullname' | 'internalemailaddress' | 'azureactivedirectoryobjectid' | 'isdisabled' | 'accessmode'>>(options), {
      select: ['systemuserid', 'fullname', 'internalemailaddress', 'azureactivedirectoryobjectid', 'isdisabled', 'accessmode'],
      filter: 'isdisabled eq false and accessmode eq 0',
      orderBy: ['fullname asc'],
    }),
    allPages(options => TransactioncurrenciesService.getAll<Pick<import('../generated/models/TransactioncurrenciesModel').Transactioncurrencies, 'transactioncurrencyid' | 'currencyname' | 'isocurrencycode'>>(options), { select: ['transactioncurrencyid', 'currencyname', 'isocurrencycode'], filter: 'statecode eq 0', orderBy: ['isocurrencycode asc'] }),
  ])
  const systemUserOptions = people.map(row => {
    const name = row.fullname?.trim()
    if (!name) throw new Error(`System user ${row.systemuserid} has no full name.`)
    return {
      id: row.systemuserid,
      name: row.internalemailaddress ? `${name} (${row.internalemailaddress})` : name,
      email: row.internalemailaddress || undefined,
      azureObjectId: row.azureactivedirectoryobjectid || undefined,
    }
  })
  return {
    clients: clients.filter(row => row.statecode === 0).map(row => ({ id: row.dredz_clientid, name: row.dredz_pm_name })),
    clientNames: clients.map(row => ({ id: row.dredz_clientid, name: row.dredz_pm_name })),
    products: products.filter(row => row.statecode === 0).map(row => ({ id: row.dredz_productid, name: row.dredz_pm_name })),
    productNames: products.map(row => ({ id: row.dredz_productid, name: row.dredz_pm_name })),
    people: systemUserOptions,
    peopleNames: systemUserOptions,
    currencies: currencies.map(row => ({ id: row.transactioncurrencyid, name: row.isocurrencycode })),
  }
}

function validateProject(input: ProjectInput) {
  if (!input.name.trim()) throw new Error('Enter a project name.')
  if (input.kind === choices.client && !input.clientId) throw new Error('Select a client for a client project.')
  if (!input.ownerId) throw new Error('Select an owner for the project.')
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw new Error('The planned end date cannot be before the start date.')
  const hasValue = input.value.trim() !== ''
  if (hasValue && (!Number.isFinite(Number(input.value)) || Number(input.value) < 0)) throw new Error('Enter a valid, non-negative project value.')
  if (hasValue && !input.currencyId) throw new Error('Select a currency for the entered value.')
  return hasValue
}

function projectFields(input: ProjectInput): Pick<Dredz_project1sBase, 'dredz_pm_name'> & Partial<Omit<Dredz_project1sBase, 'dredz_project1id' | 'statecode' | 'dredz_pm_name'>> {
  const hasValue = input.value.trim() !== ''
  return {
    dredz_pm_name: input.name.trim(),
    dredz_pm_kind: input.kind,
    dredz_pm_stage: input.stage,
    dredz_pm_pinned: input.pinned,
    ...(input.kind === choices.client ? { [`${navigation.projectClient}@odata.bind`]: bind(entitySets.client, input.clientId) } : {}),
    ...(input.productId ? { [`${navigation.projectProduct}@odata.bind`]: bind(entitySets.product, input.productId) } : {}),
    ...(input.ownerId ? { [`${navigation.projectOwner}@odata.bind`]: bind(entitySets.systemUser, input.ownerId) } : {}),
    ...(input.endDate ? { dredz_pm_enddate: input.endDate } : {}),
    ...(input.startDate ? { dredz_pm_startdate: input.startDate } : {}),
    ...(input.description.trim() ? { dredz_pm_description: input.description.trim() } : {}),
    ...(hasValue ? { dredz_pm_value: Number(input.value), [`${navigation.projectCurrency}@odata.bind`]: bind(entitySets.currency, input.currencyId) } : {}),
  }
}

export async function createProject(input: ProjectInput) {
  validateProject(input)
  return unwrap(await Dredz_project1sService.create({ ...projectFields(input), statecode: projectStateCodes.active }))
}

export async function updateProject(id: string, input: ProjectInput) {
  validateProject(input)
  const closed = input.stage === choices.completed || input.stage === choices.lost
  const record = {
    ...projectFields(input),
    ...(closed ? {
      statecode: projectStateCodes.inactive,
      statuscode: projectStatusCodes.inactive,
      dredz_pm_lastactivity: today(),
    } : {}),
    ...(input.kind !== choices.client ? { [`${navigation.projectClient}@odata.bind`]: null } : {}),
    ...(!input.productId ? { [`${navigation.projectProduct}@odata.bind`]: null } : {}),
    ...(!input.ownerId ? { [`${navigation.projectOwner}@odata.bind`]: null } : {}),
    ...(!input.endDate ? { dredz_pm_enddate: null } : {}),
    ...(!input.startDate ? { dredz_pm_startdate: null } : {}),
    ...(!input.description.trim() ? { dredz_pm_description: null } : {}),
    ...(input.value.trim() === '' ? { dredz_pm_value: null, [`${navigation.projectCurrency}@odata.bind`]: null } : {}),
  }
  unwrap(await Dredz_project1sService.update(id, record as Partial<Omit<Dredz_project1sBase, 'dredz_project1id'>>))
}

export async function closeProject(id: string, stage: ProjectInput['stage']) {
  if (stage !== choices.completed && stage !== choices.lost) throw new Error('Select the Completed or Lost stage.')
  bind(entitySets.project, id)
  unwrap(await Dredz_project1sService.update(id, {
    dredz_pm_stage: stage,
    statecode: projectStateCodes.inactive,
    statuscode: projectStatusCodes.inactive,
    dredz_pm_lastactivity: today(),
  }))
}

export async function restoreProject(id: string, stage: ProjectInput['stage']) {
  if (!(stage in openProjectStages)) throw new Error('Select an active project stage.')
  bind(entitySets.project, id)
  unwrap(await Dredz_project1sService.update(id, {
    dredz_pm_stage: stage,
    statecode: projectStateCodes.active,
    statuscode: projectStatusCodes.active,
    dredz_pm_lastactivity: today(),
  }))
}

export async function updateLastActivity(projectId: string, date: string) {
  unwrap(await Dredz_project1sService.update(projectId, { dredz_pm_lastactivity: date }))
}

function validateTask(input: TaskInput) {
  if (!input.name.trim()) throw new Error('Enter a task name.')
  if (!input.projectId) throw new Error('Select a project.')
  const hours = input.estimatedHours.trim() === '' ? undefined : Number(input.estimatedHours)
  if (hours !== undefined && (!Number.isFinite(hours) || hours < 0)) throw new Error('Estimated hours must be a non-negative number.')
  return hours
}

function taskFields(input: TaskInput): Pick<Dredz_task1sBase, 'dredz_pm_name' | 'dredz_pm_projectid@odata.bind'> & Partial<Omit<Dredz_task1sBase, 'dredz_task1id' | 'statecode' | 'dredz_pm_name' | 'dredz_pm_projectid@odata.bind'>> {
  const hours = validateTask(input)
  return {
    dredz_pm_name: input.name.trim(),
    [`${navigation.taskProject}@odata.bind` as const]: bind(entitySets.project, input.projectId),
    dredz_pm_status: input.status,
    dredz_pm_priority: input.priority,
    ...(input.ownerId ? { [`${navigation.taskOwner}@odata.bind`]: bind(entitySets.systemUser, input.ownerId) } : {}),
    ...(input.requestedById ? { [`${navigation.taskRequestedBy}@odata.bind`]: bind(entitySets.systemUser, input.requestedById) } : {}),
    ...(input.dueDate ? { dredz_pm_duedate: input.dueDate } : {}),
    ...(input.description.trim() ? { dredz_pm_description: input.description.trim() } : {}),
    ...(hours !== undefined ? { dredz_pm_estimatedhours: hours } : {}),
  }
}

async function updateTaskActivity(projectId: string): Promise<TaskSaved> {
  const activityDate = today()
  try {
    await updateLastActivity(projectId, activityDate)
    return { projectId, activityDate }
  } catch (error) {
    return { projectId, activityDate, activityError: errorMessage(error) }
  }
}

export async function createTask(input: TaskInput): Promise<TaskSaved> {
  validateTask(input)
  unwrap(await Dredz_task1sService.create({ ...taskFields(input), statecode: 0 }))
  return updateTaskActivity(input.projectId)
}

export async function updateTask(id: string, input: TaskInput): Promise<TaskSaved> {
  validateTask(input)
  const record = {
    ...taskFields(input),
    ...(!input.ownerId ? { [`${navigation.taskOwner}@odata.bind`]: null } : {}),
    ...(!input.requestedById ? { [`${navigation.taskRequestedBy}@odata.bind`]: null } : {}),
    ...(!input.dueDate ? { dredz_pm_duedate: null } : {}),
    ...(!input.description.trim() ? { dredz_pm_description: null } : {}),
    ...(input.estimatedHours.trim() === '' ? { dredz_pm_estimatedhours: null } : {}),
  }
  unwrap(await Dredz_task1sService.update(id, record as Partial<Omit<Dredz_task1sBase, 'dredz_task1id'>>))
  return updateTaskActivity(input.projectId)
}

export async function updateTaskStatus(id: string, projectId: string, status: TaskInput['status']): Promise<TaskSaved> {
  bind(entitySets.project, projectId)
  unwrap(await Dredz_task1sService.update(id, { dredz_pm_status: status }))
  return updateTaskActivity(projectId)
}

export async function deleteTask(id: string, projectId: string): Promise<TaskSaved> {
  bind(entitySets.task, id)
  bind(entitySets.project, projectId)
  unwrap(await Dredz_task1sService.delete(id))
  return updateTaskActivity(projectId)
}
