import type { IOperationResult } from '@microsoft/power-apps/data'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import type { Dredz_clients, Dredz_clientsBase } from '../generated/models/Dredz_clientsModel'
import type { Dredz_products, Dredz_productsBase } from '../generated/models/Dredz_productsModel'
import { Dredz_clientsService } from '../generated/services/Dredz_clientsService'
import { Dredz_productsService } from '../generated/services/Dredz_productsService'
import { dictionaryStateCodes, dictionaryStatusCodes } from '../config/dataverse'

export type DictionaryKind = 'client' | 'product'
export type DictionaryInput = {
  name: string
  country?: NonNullable<Dredz_clientsBase['dredz_pm_country']>
  industry?: NonNullable<Dredz_clientsBase['dredz_pm_industry']>
  contact?: string
  category?: NonNullable<Dredz_productsBase['dredz_pm_category']>
}
export type DictionaryItem = {
  kind: DictionaryKind
  id: string
  name: string
  statecode: number
  country?: DictionaryInput['country']
  industry?: DictionaryInput['industry']
  contact?: string
  category?: DictionaryInput['category']
}

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) throw result.error ?? new Error('Dataverse did not confirm the operation.')
  return result.data
}

async function allPages<T>(
  getPage: (options: IGetAllOptions) => Promise<IOperationResult<T[]>>,
  options: IGetAllOptions,
): Promise<T[]> {
  const rows: T[] = []
  let skipToken: string | undefined
  do {
    const result = await getPage({ ...options, skipToken })
    rows.push(...unwrap(result))
    skipToken = result.skipToken
  } while (skipToken)
  return rows
}

function mapClient(row: Pick<Dredz_clients, 'dredz_clientid' | 'dredz_pm_name' | 'dredz_pm_country' | 'dredz_pm_industry' | 'dredz_pm_contact' | 'statecode'>): DictionaryItem {
  return {
    kind: 'client', id: row.dredz_clientid, name: row.dredz_pm_name, statecode: row.statecode,
    country: row.dredz_pm_country, industry: row.dredz_pm_industry, contact: row.dredz_pm_contact,
  }
}

function mapProduct(row: Pick<Dredz_products, 'dredz_productid' | 'dredz_pm_name' | 'dredz_pm_category' | 'statecode'>): DictionaryItem {
  return { kind: 'product', id: row.dredz_productid, name: row.dredz_pm_name, statecode: row.statecode, category: row.dredz_pm_category }
}

function stateFilter(includeHidden: boolean) {
  return includeHidden ? undefined : `statecode eq ${dictionaryStateCodes.active}`
}

export async function loadDictionaries(kind: DictionaryKind, includeHidden = false): Promise<DictionaryItem[]> {
  const filter = stateFilter(includeHidden)
  if (kind === 'client') {
    const rows = await allPages<Pick<Dredz_clients, 'dredz_clientid' | 'dredz_pm_name' | 'dredz_pm_country' | 'dredz_pm_industry' | 'dredz_pm_contact' | 'statecode'>>(
      options => Dredz_clientsService.getAll(options),
      { select: ['dredz_clientid', 'dredz_pm_name', 'dredz_pm_country', 'dredz_pm_industry', 'dredz_pm_contact', 'statecode'], filter, orderBy: ['dredz_pm_name asc'] },
    )
    return rows.map(mapClient)
  }
  if (kind === 'product') {
    const rows = await allPages<Pick<Dredz_products, 'dredz_productid' | 'dredz_pm_name' | 'dredz_pm_category' | 'statecode'>>(
      options => Dredz_productsService.getAll(options),
      { select: ['dredz_productid', 'dredz_pm_name', 'dredz_pm_category', 'statecode'], filter, orderBy: ['dredz_pm_name asc'] },
    )
    return rows.map(mapProduct)
  }
  const rows = await allPages<Pick<Dredz_products, 'dredz_productid' | 'dredz_pm_name' | 'dredz_pm_category' | 'statecode'>>(
    options => Dredz_productsService.getAll(options),
    { select: ['dredz_productid', 'dredz_pm_name', 'dredz_pm_category', 'statecode'], filter, orderBy: ['dredz_pm_name asc'] },
  )
  return rows.map(mapProduct)
}

function validateInput(input: DictionaryInput) {
  const name = input.name.trim()
  if (!name) throw new Error('A name is required.')
  return { ...input, name }
}

async function ensureUniqueName(kind: DictionaryKind, name: string, excludedId?: string) {
  const records = await loadDictionaries(kind)
  const normalizedName = name.trim().toLowerCase()
  if (records.some(record => record.id !== excludedId && record.name.trim().toLowerCase() === normalizedName)) {
    throw new Error('An active record with this name already exists.')
  }
}

export async function createDictionary(kind: DictionaryKind, input: DictionaryInput): Promise<DictionaryItem> {
  const values = validateInput(input)
  await ensureUniqueName(kind, values.name)
  const statecode = dictionaryStateCodes.active
  if (kind === 'client') {
    const row = unwrap(await Dredz_clientsService.create({
      statecode, dredz_pm_name: values.name,
      ...(values.country !== undefined ? { dredz_pm_country: values.country } : {}),
      ...(values.industry !== undefined ? { dredz_pm_industry: values.industry } : {}),
      ...(values.contact?.trim() ? { dredz_pm_contact: values.contact.trim() } : {}),
    }))
    return mapClient(row)
  }
  const row = unwrap(await Dredz_productsService.create({
    statecode, dredz_pm_name: values.name,
    ...(values.category !== undefined ? { dredz_pm_category: values.category } : {}),
  }))
  return mapProduct(row)
}

export async function updateDictionary(kind: DictionaryKind, id: string, input: DictionaryInput): Promise<DictionaryItem> {
  const values = validateInput(input)
  await ensureUniqueName(kind, values.name, id)
  if (kind === 'client') {
    const fields = {
      dredz_pm_name: values.name,
      dredz_pm_country: values.country ?? null,
      dredz_pm_industry: values.industry ?? null,
      dredz_pm_contact: values.contact?.trim() || null,
    }
    return mapClient(unwrap(await Dredz_clientsService.update(id, fields as Partial<Omit<Dredz_clientsBase, 'dredz_clientid'>>)))
  }
  const fields = { dredz_pm_name: values.name, dredz_pm_category: values.category ?? null }
  return mapProduct(unwrap(await Dredz_productsService.update(id, fields as Partial<Omit<Dredz_productsBase, 'dredz_productid'>>)))
}

export async function hideDictionary(kind: DictionaryKind, id: string): Promise<void> {
  const fields = { statecode: dictionaryStateCodes.inactive, statuscode: dictionaryStatusCodes.inactive }
  if (kind === 'client') unwrap(await Dredz_clientsService.update(id, fields))
  else unwrap(await Dredz_productsService.update(id, fields))
}

export async function restoreDictionary(kind: DictionaryKind, id: string): Promise<void> {
  const fields = { statecode: dictionaryStateCodes.active, statuscode: dictionaryStatusCodes.active }
  if (kind === 'client') unwrap(await Dredz_clientsService.update(id, fields))
  else unwrap(await Dredz_productsService.update(id, fields))
}
