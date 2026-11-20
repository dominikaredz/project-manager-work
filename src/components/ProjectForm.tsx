import { useState } from 'react'
import { choices, openProjectStages, projectKinds, projectStages } from '../config/dataverse'
import { createProject, errorMessage, updateProject } from '../data/projects'
import type { Lookups, Option, Project, ProjectInput } from '../data/projects'
import { ChoiceField, LookupField } from './FormFields'
import { DictionaryForm } from './DictionaryForm'
import type { DictionaryItem, DictionaryKind } from '../data/dictionaries'

export function ProjectForm({ lookups, project, onSaved, onCancel }: { lookups: Lookups; project?: Project; onSaved: (closed: boolean) => void; onCancel: () => void }) {
  const [input, setInput] = useState<ProjectInput>(() => project ? {
    name: project.dredz_pm_name,
    kind: project.dredz_pm_kind ?? choices.internal,
    clientId: project._dredz_pm_clientid_value ?? '',
    productId: project._dredz_pm_productid_value ?? '',
    ownerId: project._dredz_pm_owner_value ?? '',
    stage: project.dredz_pm_stage ?? choices.lead,
    endDate: project.dredz_pm_enddate?.slice(0, 10) ?? '',
    startDate: project.dredz_pm_startdate?.slice(0, 10) ?? '',
    description: project.dredz_pm_description ?? '',
    pinned: project.dredz_pm_pinned ?? false,
    value: project.dredz_pm_value == null ? '' : String(project.dredz_pm_value),
    currencyId: project._transactioncurrencyid_value ?? '',
  } : {
    name: '', kind: choices.internal, clientId: '', productId: '', ownerId: '', stage: choices.lead,
    endDate: '', startDate: '', description: '', pinned: false, value: '', currencyId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [quickCreate, setQuickCreate] = useState<DictionaryKind | null>(null)
  const [addedClients, setAddedClients] = useState<Option[]>([])
  const [addedProducts, setAddedProducts] = useState<Option[]>([])
  const clientOptions = [...lookups.clients, ...addedClients]
  const productOptions = [...lookups.products, ...addedProducts]
  const personOptions = lookups.people
  const selectedClientHidden = Boolean(project && input.clientId === project._dredz_pm_clientid_value && !clientOptions.some(option => option.id === input.clientId))
  const selectedProductHidden = Boolean(project && input.productId === project._dredz_pm_productid_value && !productOptions.some(option => option.id === input.productId))
  const selectedOwnerHidden = Boolean(project && input.ownerId === project._dredz_pm_owner_value && !personOptions.some(option => option.id === input.ownerId))
  const hiddenClientName = lookups.clientNames.find(option => option.id === input.clientId)?.name
  const hiddenProductName = lookups.productNames.find(option => option.id === input.productId)?.name
  const hiddenOwnerName = lookups.peopleNames.find(option => option.id === input.ownerId)?.name
  function dictionarySaved(item: DictionaryItem) {
    const option = { id: item.id, name: item.name }
    if (item.kind === 'client') {
      setAddedClients(previous => [...previous, option])
      change('clientId', item.id)
    } else {
      setAddedProducts(previous => [...previous, option])
      change('productId', item.id)
    }
    setQuickCreate(null)
  }
  function change<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setInput(previous => ({ ...previous, [key]: value }))
  }
  return <section className="panel form-panel" aria-labelledby="project-form-title">
    <h2 id="project-form-title">{project ? 'Edit project' : 'New project'}</h2>
    <form onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      setSaving(true)
      setError('')
      try {
        if (project) await updateProject(project.dredz_project1id, input)
        else await createProject(input)
        onSaved(input.stage === choices.completed || input.stage === choices.lost)
      } catch (error) {
        setError(`Could not ${project ? 'save' : 'create'} the project. ${errorMessage(error)}`)
      } finally { setSaving(false) }
    }}>
      <fieldset disabled={saving}>
        <div className="form-grid">
          <label className="wide">Project name *<input autoFocus required value={input.name} onChange={event => change('name', event.target.value)} /></label>
          <ChoiceField label="Type" value={input.kind} labels={projectKinds} onChange={value => {
            setInput(previous => ({ ...previous, kind: value, clientId: value === choices.client ? previous.clientId : '' }))
          }} />
          {input.kind === choices.client && <div className="lookup-create-field">
            {selectedClientHidden && <p className="muted">Current client: {hiddenClientName} (hidden)</p>}
            <LookupField label="Client" required={!selectedClientHidden} value={selectedClientHidden ? '' : input.clientId} options={clientOptions} onChange={value => change('clientId', value)} />
            <button type="button" className="link-button" onClick={() => setQuickCreate('client')}>+ New client</button>
          </div>}
          <div className="lookup-create-field">
            {selectedProductHidden && <p className="muted">Current product: {hiddenProductName} (hidden)</p>}
            <LookupField label="Product" value={selectedProductHidden ? '' : input.productId} options={productOptions} onChange={value => change('productId', value)} />
            <button type="button" className="link-button" onClick={() => setQuickCreate('product')}>+ New product</button>
          </div>
          <ChoiceField label="Stage" value={input.stage} labels={project ? projectStages : openProjectStages} onChange={value => change('stage', value)} />
          <div className="lookup-create-field">
            {selectedOwnerHidden && <p className="muted">Current owner: {hiddenOwnerName ?? 'not available in the active user list'} (hidden)</p>}
            <LookupField label="Owner" required value={selectedOwnerHidden ? '' : input.ownerId} options={personOptions} onChange={value => change('ownerId', value)} />
          </div>
          <label>Planned end date<input type="date" value={input.endDate} onChange={event => change('endDate', event.target.value)} /></label>
        </div>
        {quickCreate && <DictionaryForm key={quickCreate} kind={quickCreate} compact onCancel={() => setQuickCreate(null)} onSaved={dictionarySaved} />}
        <details><summary>More fields</summary><div className="form-grid">
          <label>Start date<input type="date" value={input.startDate} onChange={event => change('startDate', event.target.value)} /></label>
          <label>Value<input type="number" min="0" step="0.01" value={input.value} onChange={event => {
            setInput(previous => ({ ...previous, value: event.target.value, currencyId: event.target.value === '' ? '' : previous.currencyId }))
          }} /></label>
          {input.value !== '' && <LookupField label="Currency" required value={input.currencyId} options={lookups.currencies} onChange={value => change('currencyId', value)} />}
          <label className="wide">Description<textarea rows={3} value={input.description} onChange={event => change('description', event.target.value)} /></label>
          <label className="checkbox"><input type="checkbox" checked={input.pinned} onChange={event => change('pinned', event.target.checked)} />Pin project</label>
        </div></details>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button type="submit">{saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></div>
      </fieldset>
    </form>
  </section>
}
