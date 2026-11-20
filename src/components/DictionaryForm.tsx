import { useState } from 'react'
import { clientCountries, clientIndustries, productCategories } from '../config/dataverse'
import { errorMessage } from '../data/projects'
import { createDictionary, updateDictionary } from '../data/dictionaries'
import type { DictionaryInput, DictionaryItem, DictionaryKind } from '../data/dictionaries'

function OptionalChoiceField<T extends number>({ label, value, labels, onChange }: {
  label: string; value?: T; labels: Readonly<Record<T, string>>; onChange: (value: T | undefined) => void
}) {
  return <label>{label}
    <select value={value ?? ''} onChange={event => {
      const selected = (Object.keys(labels).map(Number) as T[]).find(option => option === Number(event.target.value))
      onChange(event.target.value === '' ? undefined : selected)
    }}>
      <option value="">Select…</option>
      {Object.keys(labels).map(key => <option key={key} value={key}>{labels[Number(key) as T]}</option>)}
    </select>
  </label>
}

const kindNames: Record<DictionaryKind, string> = { client: 'client', product: 'product' }

export function DictionaryForm({ kind, entry, compact = false, onSaved, onCancel }: {
  kind: DictionaryKind; entry?: DictionaryItem; compact?: boolean
  onSaved: (item: DictionaryItem) => void; onCancel: () => void
}) {
  const [input, setInput] = useState<DictionaryInput>(() => ({
    name: entry?.name ?? '',
    country: entry?.country,
    industry: entry?.industry,
    contact: entry?.contact ?? '',
    category: entry?.category,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function change<K extends keyof DictionaryInput>(key: K, value: DictionaryInput[K]) {
    setInput(previous => ({ ...previous, [key]: value }))
  }
  async function save() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const saved = entry
        ? await updateDictionary(kind, entry.id, input)
        : await createDictionary(kind, input)
      onSaved(saved)
    } catch (error) {
      setError(`Could not ${entry ? 'save' : 'create'} ${kindNames[kind]}. ${errorMessage(error)}`)
    } finally { setSaving(false) }
  }
  const fields = <fieldset disabled={saving}>
    <div className="form-grid">
      <label className="wide">Name *<input autoFocus required value={input.name} onChange={event => change('name', event.target.value)} /></label>
      {kind === 'client' && <>
        <OptionalChoiceField label="Country" value={input.country} labels={clientCountries} onChange={value => change('country', value)} />
        <OptionalChoiceField label="Industry" value={input.industry} labels={clientIndustries} onChange={value => change('industry', value)} />
        <label>Contact person<input value={input.contact ?? ''} onChange={event => change('contact', event.target.value)} /></label>
      </>}
      {kind === 'product' && <OptionalChoiceField label="Category" value={input.category} labels={productCategories} onChange={value => change('category', value)} />}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
      <button type={compact ? 'button' : 'submit'} onClick={compact ? () => { void save() } : undefined}>{saving ? 'Saving…' : entry ? 'Save changes' : 'Add'}</button>
      <button type="button" className="secondary" disabled={saving} onClick={onCancel}>Cancel</button>
    </div>
  </fieldset>

  return <section className={`panel form-panel dictionary-form ${compact ? 'mini-dictionary-form' : ''}`} aria-label={`${entry ? 'Edit' : 'New'} ${kindNames[kind]}`} onKeyDown={compact ? event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void save()
    }
  } : undefined}>
    <h3>{entry ? 'Edit' : 'New'} {kindNames[kind]}</h3>
    {compact ? fields : <form onSubmit={event => { event.preventDefault(); void save() }}>{fields}</form>}
  </section>
}
