import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const mockPath = fileURLToPath(new URL('./power-data.mjs', import.meta.url))
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: [{ find: '@microsoft/power-apps/data', replacement: mockPath }] },
})
const data = await server.ssrLoadModule('/src/data/projects.ts')
const projectFilters = await server.ssrLoadModule('/src/data/projectFilters.ts')
const myTasks = await server.ssrLoadModule('/src/data/myTasks.ts')
const dictionaries = await server.ssrLoadModule('/src/data/dictionaries.ts')
const { state } = await server.ssrLoadModule(mockPath)
after(() => server.close())
beforeEach(() => {
  state.calls.length = 0
  state.pages.length = 0
  state.createError = null
  state.updateError = null
  state.deleteError = null
})

const projectId = '11111111-1111-1111-1111-111111111111'
const personId = '22222222-2222-2222-2222-222222222222'
const clientId = '33333333-3333-3333-3333-333333333333'
const currencyId = '44444444-4444-4444-4444-444444444444'
const project = {
  name: ' Projekt testowy ', kind: 707970001, stage: 707970000,
  clientId: '', productId: '', ownerId: personId, endDate: '', startDate: '',
  description: '', pinned: false, value: '', currencyId: '',
}
const task = {
  name: ' Zadanie testowe ', projectId, ownerId: personId, requestedById: personId,
  dueDate: '2026-12-01', status: 707970000, priority: 707970001,
  description: '', estimatedHours: '',
}

test('internal project omits client and currency, even with stale selections', async () => {
  await data.createProject({ ...project, clientId, currencyId })
  const { table, record } = state.calls[0]
  assert.equal(table, 'dredz_project1s')
  assert.equal(record.dredz_pm_name, 'Projekt testowy')
  assert.equal(record.statecode, 0)
  assert.equal('dredz_pm_clientid@odata.bind' in record, false)
  assert.equal('transactioncurrencyid@odata.bind' in record, false)
})

test('client project requires a client and uses the configured bind', async () => {
  await assert.rejects(data.createProject({ ...project, kind: 707970000 }), /Select a client/)
  assert.equal(state.calls.length, 0)
  await data.createProject({ ...project, kind: 707970000, clientId, ownerId: personId })
  assert.equal(state.calls[0].record['dredz_pm_clientid@odata.bind'], `/dredz_clients(${clientId})`)
  assert.equal(state.calls[0].record['dredz_pm_owner@odata.bind'], `/systemusers(${personId})`)
})

test('projects require an owner on create and update', async () => {
  await assert.rejects(data.createProject({ ...project, ownerId: '' }), /Select an owner/)
  await assert.rejects(data.updateProject(projectId, { ...project, ownerId: '' }), /Select an owner/)
  assert.equal(state.calls.length, 0)
})

test('project updates validate client projects and clear empty lookups', async () => {
  await assert.rejects(data.updateProject(projectId, { ...project, kind: 707970000 }), /Select a client/)
  assert.equal(state.calls.length, 0)
  await data.updateProject(projectId, { ...project, clientId, kind: 707970000 })
  assert.equal(state.calls[0].operation, 'update')
  assert.equal(state.calls[0].table, 'dredz_project1s')
  assert.equal(state.calls[0].id, projectId)
  assert.equal(state.calls[0].record['dredz_pm_clientid@odata.bind'], `/dredz_clients(${clientId})`)
  await data.updateProject(projectId, project)
  assert.equal(state.calls[1].record['dredz_pm_clientid@odata.bind'], null)
  assert.equal(state.calls[1].record['dredz_pm_productid@odata.bind'], null)
  assert.equal(state.calls[1].record['dredz_pm_owner@odata.bind'], `/systemusers(${personId})`)
  assert.equal(state.calls[1].record.dredz_pm_name, 'Projekt testowy')
})

test('closing a project updates its stage, state, status, and activity in one request', async () => {
  await data.closeProject(projectId, 707970005)
  assert.equal(state.calls.length, 1)
  assert.deepEqual(state.calls[0].record, {
    dredz_pm_stage: 707970005,
    statecode: 1,
    statuscode: 2,
    dredz_pm_lastactivity: data.today(),
  })
  state.calls.length = 0
  await data.closeProject(projectId, 707970006)
  assert.equal(state.calls[0].record.dredz_pm_stage, 707970006)
  assert.equal(state.calls[0].record.statecode, 1)
  await assert.rejects(data.closeProject(projectId, 707970001), /Completed or Lost/)
  assert.equal(state.calls.length, 1)
})

test('restoring a project activates it and sets its chosen open stage and activity', async () => {
  await data.restoreProject(projectId, 707970004)
  assert.equal(state.calls.length, 1)
  assert.deepEqual(state.calls[0].record, {
    dredz_pm_stage: 707970004,
    statecode: 0,
    statuscode: 1,
    dredz_pm_lastactivity: data.today(),
  })
  await assert.rejects(data.restoreProject(projectId, 707970005), /active project stage/)
  assert.equal(state.calls.length, 1)
})

test('editing a project to either closed stage deactivates it', async () => {
  for (const stage of [707970005, 707970006]) {
    state.calls.length = 0
    await data.updateProject(projectId, { ...project, stage })
    assert.equal(state.calls.length, 1)
    assert.equal(state.calls[0].record.dredz_pm_stage, stage)
    assert.equal(state.calls[0].record.statecode, 1)
    assert.equal(state.calls[0].record.statuscode, 2)
    assert.equal(state.calls[0].record.dredz_pm_lastactivity, data.today())
  }
})

test('zero is a value and needs an explicitly selected currency', async () => {
  await assert.rejects(data.createProject({ ...project, value: '0' }), /Select a currency/)
  await assert.rejects(data.createProject({ ...project, value: '-1', currencyId }), /non-negative project value/)
  assert.equal(state.calls.length, 0)
  await data.createProject({ ...project, value: '0', currencyId })
  assert.equal(state.calls[0].record.dredz_pm_value, 0)
  assert.equal(state.calls[0].record['transactioncurrencyid@odata.bind'], `/transactioncurrencies(${currencyId})`)
})

test('task requires a project and updates its last activity after a successful create', async () => {
  await assert.rejects(data.createTask({ ...task, projectId: '' }), /Select a project/)
  assert.equal(state.calls.length, 0)
  const before = data.today()
  const result = await data.createTask(task)
  assert.equal(state.calls[0].table, 'dredz_task1s')
  assert.equal(state.calls[0].record['dredz_pm_projectid@odata.bind'], `/dredz_project1s(${projectId})`)
  assert.equal(state.calls[0].record['dredz_pm_owner@odata.bind'], `/systemusers(${personId})`)
  assert.equal(state.calls[0].record['dredz_pm_requestedby@odata.bind'], `/systemusers(${personId})`)
  assert.equal(state.calls[0].record.dredz_pm_status, 707970000)
  assert.equal(state.calls[1].operation, 'update')
  assert.equal(state.calls[1].table, 'dredz_project1s')
  assert.equal(state.calls[1].id, projectId)
  assert.ok([before, data.today()].includes(state.calls[1].record.dredz_pm_lastactivity))
  assert.equal(result.activityError, undefined)
})

test('task edits clear empty fields and update project activity after saving', async () => {
  const result = await data.updateTask('55555555-5555-5555-5555-555555555555', { ...task, ownerId: '', requestedById: '', dueDate: '', estimatedHours: '' })
  assert.equal(state.calls[0].operation, 'update')
  assert.equal(state.calls[0].table, 'dredz_task1s')
  assert.equal(state.calls[0].record['dredz_pm_owner@odata.bind'], null)
  assert.equal(state.calls[0].record['dredz_pm_requestedby@odata.bind'], null)
  assert.equal(state.calls[0].record.dredz_pm_duedate, null)
  assert.equal(state.calls[0].record.dredz_pm_estimatedhours, null)
  assert.equal(state.calls[1].record.dredz_pm_lastactivity, data.today())
  assert.equal(result.projectId, projectId)
})

test('quick task status update writes only status and then updates project activity', async () => {
  const result = await data.updateTaskStatus('55555555-5555-5555-5555-555555555555', projectId, 707970003)
  assert.equal(state.calls[0].operation, 'update')
  assert.equal(state.calls[0].table, 'dredz_task1s')
  assert.deepEqual(state.calls[0].record, { dredz_pm_status: 707970003 })
  assert.equal(state.calls[1].table, 'dredz_project1s')
  assert.equal(state.calls[1].record.dredz_pm_lastactivity, data.today())
  assert.equal(result.activityError, undefined)
})

test('deleting a task updates its project last activity', async () => {
  const taskId = '55555555-5555-5555-5555-555555555555'
  const result = await data.deleteTask(taskId, projectId)
  assert.deepEqual(state.calls.slice(0, 2), [
    { operation: 'delete', table: 'dredz_task1s', id: taskId },
    { operation: 'update', table: 'dredz_project1s', id: projectId, record: { dredz_pm_lastactivity: data.today() } },
  ])
  assert.equal(result.projectId, projectId)
  assert.equal(result.activityError, undefined)
})

test('a failed task create surfaces the exact error and does not update the project', async () => {
  state.createError = new Error("Could not find a property named 'dredz_pm_projectid'")
  await assert.rejects(data.createTask(task), { message: state.createError.message })
  assert.deepEqual(state.calls.map(call => call.operation), ['create'])
})

test('partial success reports the update error; retry does not duplicate the task', async () => {
  state.updateError = new Error('Dataverse update failed')
  const result = await data.createTask(task)
  assert.equal(result.activityError, 'Dataverse update failed')
  state.updateError = null
  await data.updateLastActivity(result.projectId, result.activityDate)
  assert.deepEqual(state.calls.map(call => call.operation), ['create', 'update', 'update'])
})

test('project queries exclude inactive, Completed and Lost records and follow paging', async () => {
  state.pages.push(
    { success: true, data: [{ dredz_project1id: projectId }], skipToken: 'next-page' },
    { success: true, data: [{ dredz_project1id: clientId }] },
  )
  const rows = await data.loadProjects()
  assert.equal(rows.length, 2)
  assert.equal(state.calls[1].options.skipToken, 'next-page')
  assert.equal(state.calls[0].options.filter, 'statecode eq 0 and (dredz_pm_stage eq null or (dredz_pm_stage ne 707970005 and dredz_pm_stage ne 707970006))')
  assert.ok(state.calls[0].options.select.includes('_dredz_pm_owner_value'))
  state.calls.length = 0
  await data.loadProjects(true)
  assert.equal(state.calls[0].options.filter, 'statecode eq 1')
  assert.deepEqual(state.calls[0].options.orderBy, ['dredz_pm_lastactivity desc', 'dredz_pm_name asc'])
  state.calls.length = 0
  await data.loadTasks(projectId)
  assert.equal(state.calls[0].options.filter, `statecode eq 0 and _dredz_pm_projectid_value eq ${projectId}`)
  assert.ok(state.calls[0].options.select.includes('dredz_pm_status'))
})

test('project search matches names without Polish diacritics', () => {
  const rows = [
    { dredz_project1id: projectId, dredz_pm_name: 'Zarządzanie Łodzią', _dredz_pm_clientid_value: clientId },
    { dredz_project1id: personId, dredz_pm_name: 'Other project' },
  ]
  const filters = { ...projectFilters.emptyProjectFilters(), search: 'zarzadzanie lodzia' }
  const result = projectFilters.filterProjects(rows, filters, { clientNames: [{ id: clientId, name: 'TEST Żółty Klient' }] })
  assert.deepEqual(result.map(row => row.dredz_project1id), [projectId])
})

test('project filters combine stage, type, client, product, and owner', () => {
  const rows = [
    {
      dredz_project1id: projectId, dredz_pm_name: 'TEST matching', dredz_pm_stage: 707970000, dredz_pm_kind: 707970000,
      _dredz_pm_clientid_value: clientId, _dredz_pm_productid_value: currencyId, _dredz_pm_owner_value: personId,
    },
    {
      dredz_project1id: personId, dredz_pm_name: 'TEST different owner', dredz_pm_stage: 707970000, dredz_pm_kind: 707970000,
      _dredz_pm_clientid_value: clientId, _dredz_pm_productid_value: currencyId, _dredz_pm_owner_value: clientId,
    },
  ]
  const filters = {
    ...projectFilters.emptyProjectFilters(),
    stage: '707970000', kind: '707970000', clientId, productId: currencyId, ownerId: personId,
  }
  const result = projectFilters.filterProjects(rows, filters, { clientNames: [] })
  assert.deepEqual(result.map(row => row.dredz_project1id), [projectId])
})

test('No client and No owner filters match projects with missing lookups', () => {
  const rows = [
    { dredz_project1id: projectId, dredz_pm_name: 'TEST no client', _dredz_pm_owner_value: personId },
    { dredz_project1id: personId, dredz_pm_name: 'TEST no owner', _dredz_pm_clientid_value: clientId },
  ]
  const noClient = projectFilters.filterProjects(
    rows,
    { ...projectFilters.emptyProjectFilters(), clientId: projectFilters.NO_PROJECT_FILTER },
    { clientNames: [] },
  )
  const noOwner = projectFilters.filterProjects(
    rows,
    { ...projectFilters.emptyProjectFilters(), ownerId: projectFilters.NO_PROJECT_FILTER },
    { clientNames: [] },
  )
  assert.deepEqual(noClient.map(row => row.dredz_project1id), [projectId])
  assert.deepEqual(noOwner.map(row => row.dredz_project1id), [personId])
})

test('My projects includes owned projects and projects with active tasks assigned to the person', () => {
  const rows = [
    { dredz_project1id: projectId, _dredz_pm_owner_value: personId },
    { dredz_project1id: clientId, _dredz_pm_owner_value: clientId },
    { dredz_project1id: currencyId, _dredz_pm_owner_value: clientId },
    { dredz_project1id: '77777777-7777-7777-7777-777777777777', _dredz_pm_owner_value: clientId },
  ]
  const activeTasks = [
    { _dredz_pm_projectid_value: currencyId, _dredz_pm_owner_value: personId },
    { _dredz_pm_projectid_value: clientId, _dredz_pm_owner_value: clientId },
    { _dredz_pm_projectid_value: '77777777-7777-7777-7777-777777777777', _dredz_pm_owner_value: personId, dredz_pm_status: 707970003 },
  ]
  const result = projectFilters.filterMyProjects(rows, personId, activeTasks)
  assert.deepEqual(result.map(row => row.dredz_project1id), [projectId, currencyId])
})

test('my task sections use Monday-to-Sunday weeks and omit completed tasks', () => {
  const rows = [
    { dredz_task1id: 'overdue', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-17' },
    { dredz_task1id: 'today', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-18' },
    { dredz_task1id: 'sunday', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-22' },
    { dredz_task1id: 'next-monday', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-23' },
    { dredz_task1id: 'next-sunday', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-29' },
    { dredz_task1id: 'later', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-30' },
    { dredz_task1id: 'no-date', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId },
    { dredz_task1id: 'done', _dredz_pm_projectid_value: projectId, _dredz_pm_owner_value: personId, dredz_pm_duedate: '2026-11-18', dredz_pm_status: 707970003 },
  ]
  const sections = myTasks.groupMyTasks(rows, [{ dredz_project1id: projectId }], personId, new Date('2026-11-18T12:00:00+01:00'))
  assert.deepEqual(sections.overdue.map(row => row.dredz_task1id), ['overdue'])
  assert.deepEqual(sections.thisWeek.map(row => row.dredz_task1id), ['today', 'sunday'])
  assert.deepEqual(sections.nextWeek.map(row => row.dredz_task1id), ['next-monday', 'next-sunday'])
  assert.deepEqual(sections.later.map(row => row.dredz_task1id), ['later'])
  assert.deepEqual(sections.noDueDate.map(row => row.dredz_task1id), ['no-date'])
})

test('days without project activity are calculated by local calendar date', () => {
  const now = new Date('2026-11-20T12:00:00+01:00')
  assert.equal(myTasks.daysSinceActivity('2026-11-05', now), 15)
  assert.equal(myTasks.daysSinceActivity('2026-11-06', now), 14)
  assert.equal(myTasks.daysSinceActivity(undefined, now), undefined)
})

test('incomplete task count includes null statuses and reads every related task', async () => {
  state.pages.push({ success: true, data: [{ dredz_task1id: personId }, { dredz_task1id: clientId }] })
  assert.equal(await data.countIncompleteTasks(projectId), 2)
  assert.equal(state.calls[0].options.filter, `_dredz_pm_projectid_value eq ${projectId} and (dredz_pm_status eq null or dredz_pm_status ne 707970003)`)
})

test('lookups load enabled read-write SystemUsers and match the SDK identity', async () => {
  const azureObjectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  state.pages.push(
    { success: true, data: [] },
    { success: true, data: [] },
    { success: true, data: [{
      systemuserid: personId,
      fullname: 'TEST User',
      internalemailaddress: 'test@example.com',
      azureactivedirectoryobjectid: azureObjectId,
      isdisabled: false,
      accessmode: 0,
    }] },
    { success: true, data: [] },
  )
  const lookups = await data.loadLookups()
  const userQuery = state.calls.find(call => call.table === 'systemusers')
  assert.deepEqual(userQuery.options.select, ['systemuserid', 'fullname', 'internalemailaddress', 'azureactivedirectoryobjectid', 'isdisabled', 'accessmode'])
  assert.equal(userQuery.options.filter, 'isdisabled eq false and accessmode eq 0')
  assert.deepEqual(userQuery.options.orderBy, ['fullname asc'])
  assert.deepEqual(lookups.people, [{
    id: personId,
    name: 'TEST User (test@example.com)',
    email: 'test@example.com',
    azureObjectId,
  }])
  assert.equal(data.findSystemUser(lookups.people, { systemUserId: personId })?.id, personId)
  assert.equal(data.findSystemUser(lookups.people, { objectId: azureObjectId })?.id, personId)
  assert.equal(data.findSystemUser(lookups.people, { userPrincipalName: 'TEST@example.com' })?.id, personId)
})

test('dictionary creation writes client details and product category', async () => {
  await dictionaries.createDictionary('client', {
    name: 'TEST Klient', country: 707970002, industry: 707970001, contact: 'TEST Kontakt',
  })
  await dictionaries.createDictionary('product', { name: 'TEST Produkt', category: 707970000 })
  assert.equal(state.calls[1].table, 'dredz_clients')
  assert.deepEqual(state.calls[1].record, {
    statecode: 0,
    dredz_pm_name: 'TEST Klient',
    dredz_pm_country: 707970002,
    dredz_pm_industry: 707970001,
    dredz_pm_contact: 'TEST Kontakt',
  })
  assert.equal(state.calls[3].table, 'dredz_products')
  assert.deepEqual(state.calls[3].record, {
    statecode: 0,
    dredz_pm_name: 'TEST Produkt',
    dredz_pm_category: 707970000,
  })
})

test('dictionary creation blocks active names ignoring case and surrounding spaces', async () => {
  state.pages.push({ success: true, data: [{ dredz_clientid: clientId, dredz_pm_name: ' Acme ', statecode: 0 }] })
  await assert.rejects(dictionaries.createDictionary('client', { name: 'acme' }), /already exists/)
  assert.equal(state.calls.length, 1)
  assert.equal(state.calls[0].options.filter, 'statecode eq 0')
})

test('dictionaries can be hidden and restored without deletion', async () => {
  await dictionaries.hideDictionary('product', clientId)
  assert.deepEqual(state.calls[0], {
    operation: 'update',
    table: 'dredz_products',
    id: clientId,
    record: { statecode: 1, statuscode: 2 },
  })
  await dictionaries.restoreDictionary('product', clientId)
  assert.deepEqual(state.calls[1], {
    operation: 'update',
    table: 'dredz_products',
    id: clientId,
    record: { statecode: 0, statuscode: 1 },
  })
})
