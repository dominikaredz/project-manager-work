import type { Dredz_project1sdredz_pm_kind, Dredz_project1sdredz_pm_stage } from '../generated/models/Dredz_project1sModel'
import type { Dredz_task1sdredz_pm_priority, Dredz_task1sdredz_pm_status } from '../generated/models/Dredz_task1sModel'
import type { Dredz_clientsdredz_pm_country, Dredz_clientsdredz_pm_industry } from '../generated/models/Dredz_clientsModel'
import type { Dredz_productsdredz_pm_category } from '../generated/models/Dredz_productsModel'

export const entitySets = {
  project: 'dredz_project1s',
  task: 'dredz_task1s',
  client: 'dredz_clients',
  product: 'dredz_products',
  systemUser: 'systemusers',
  currency: 'transactioncurrencies',
} as const

export const navigation = {
  projectClient: 'dredz_pm_clientid',
  projectProduct: 'dredz_pm_productid',
  projectOwner: 'dredz_pm_owner',
  ideaOwner: 'dredz_pm_owner',
  projectCurrency: 'transactioncurrencyid',
  taskProject: 'dredz_pm_projectid',
  taskOwner: 'dredz_pm_owner',
  taskRequestedBy: 'dredz_pm_requestedby',
} as const

export const projectKinds = {
  707970000: 'Client',
  707970001: 'Internal',
} satisfies Record<Dredz_project1sdredz_pm_kind, string>

export const projectStages = {
  707970000: 'Lead',
  707970001: 'Opportunity',
  707970002: 'Budget approved',
  707970003: 'POC',
  707970004: 'In progress',
  707970005: 'Completed',
  707970006: 'Lost',
} satisfies Record<Dredz_project1sdredz_pm_stage, string>

export const openProjectStages = {
  707970000: projectStages[707970000],
  707970001: projectStages[707970001],
  707970002: projectStages[707970002],
  707970003: projectStages[707970003],
  707970004: projectStages[707970004],
} satisfies Partial<Record<Dredz_project1sdredz_pm_stage, string>>

export const taskStatuses = {
  707970000: 'Not started',
  707970001: 'In progress',
  707970002: 'Blocked',
  707970003: 'Done',
} satisfies Record<Dredz_task1sdredz_pm_status, string>

export const taskPriorities = {
  707970000: 'Low',
  707970001: 'Medium',
  707970002: 'High',
} satisfies Record<Dredz_task1sdredz_pm_priority, string>

export const clientCountries = {
  707970000: 'Slovakia',
  707970001: 'Greece',
  707970002: 'Poland',
  707970003: 'Other country',
} satisfies Record<Dredz_clientsdredz_pm_country, string>

export const clientIndustries = {
  707970000: 'Finance',
  707970001: 'Technology',
  707970002: 'Healthcare',
  707970003: 'Other industry',
} satisfies Record<Dredz_clientsdredz_pm_industry, string>

export const productCategories = {
  707970000: 'Power Apps',
  707970001: 'Power BI',
  707970002: 'Fabric',
  707970003: 'Copilot Studio',
  707970004: 'Automations',
  707970005: 'Other category',
} satisfies Record<Dredz_productsdredz_pm_category, string>

export const choices = {
  client: 707970000,
  internal: 707970001,
  lead: 707970000,
  completed: 707970005,
  lost: 707970006,
  notStarted: 707970000,
  medium: 707970001,
  done: 707970003,
} as const

export const projectStateCodes = {
  active: 0,
  inactive: 1,
} as const

export const projectStatusCodes = {
  active: 1,
  inactive: 2,
} as const

export const dictionaryStateCodes = {
  active: 0,
  inactive: 1,
} as const

export const dictionaryStatusCodes = {
  active: 1,
  inactive: 2,
} as const

export const projectInactivityDays = 14

export function choiceLabel(labels: Readonly<Record<number, string>>, value?: number) {
  return value == null ? 'Not set' : labels[value] ?? `Unknown option (${value})`
}
