import { useEffect, useState } from 'react'
import { choiceLabel, clientCountries, clientIndustries, productCategories } from '../config/dataverse'
import { errorMessage } from '../data/projects'
import { hideDictionary, loadDictionaries, restoreDictionary } from '../data/dictionaries'
import type { DictionaryItem, DictionaryKind } from '../data/dictionaries'
import { DictionaryForm } from './DictionaryForm'
import { Icon, Modal } from './ui'

const tabs: { kind: DictionaryKind; label: string }[] = [
  { kind: 'client', label: 'Clients' },
  { kind: 'product', label: 'Products' },
]

export function DictionariesView() {
  const [kind, setKind] = useState<DictionaryKind>('client')
  const [showHidden, setShowHidden] = useState(false)
  const [items, setItems] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [editor, setEditor] = useState<DictionaryItem | null | undefined>(undefined)
  const [confirmHide, setConfirmHide] = useState<DictionaryItem | null>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    loadDictionaries(kind, showHidden).then(rows => {
      if (active) { setItems(rows); setError(''); setLoading(false) }
    }).catch(error => {
      if (active) { setError(errorMessage(error)); setLoading(false) }
    })
    return () => { active = false }
  }, [kind, showHidden, revision])

  function refresh() {
    setLoading(true)
    setRevision(value => value + 1)
  }

  return <section className="card dictionaries-panel" aria-label="Dictionaries">
    <div className="card-head">
    <div className="segmented" role="tablist" aria-label="Dictionary type">
      {tabs.map(tab => <button key={tab.kind} role="tab" aria-selected={kind === tab.kind} className={kind === tab.kind ? 'active' : ''} disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={() => {
        setLoading(true)
        setKind(tab.kind)
        setEditor(undefined)
        setConfirmHide(null)
        setNotice('')
        setActionError('')
      }}>{tab.label}</button>)}
    </div>
    <div className="actions">
      <button className={`toggle-pill ${showHidden ? 'active' : ''}`} aria-pressed={showHidden} disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={() => {
        setLoading(true)
        setShowHidden(value => !value)
        setEditor(undefined)
        setConfirmHide(null)
        setActionError('')
      }}>{showHidden ? 'Hide inactive' : 'Show hidden'}</button>
      <button disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={() => { setEditor(null); setNotice('') }}><Icon name="plus" size={16} />Add</button>
    </div>
    </div>
    {notice && <p className="success" role="status">{notice}</p>}
    {error && <div className="error" role="alert">Could not load the dictionary. {error}<button className="secondary" onClick={refresh}>Try again</button></div>}
    {actionError && !confirmHide && <p className="error" role="alert">{actionError}</p>}
    {editor !== undefined && <Modal onClose={() => setEditor(undefined)}><DictionaryForm key={`${kind}-${editor?.id ?? 'new'}`} kind={kind} entry={editor ?? undefined} onCancel={() => setEditor(undefined)} onSaved={() => {
      setEditor(undefined)
      setNotice(editor ? 'Zmiany zapisano.' : 'Dodano rekord.')
      refresh()
    }} /></Modal>}
    {confirmHide && <section className="delete-confirmation" role="alertdialog" aria-labelledby="hide-dictionary-title">
      <p id="hide-dictionary-title">Hide “{confirmHide.name}”? The record will remain in Dataverse but will not be available in selection lists.</p>
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <div className="actions">
        <button disabled={busyId !== ''} onClick={async () => {
          setBusyId(confirmHide.id)
          setActionError('')
          try {
            await hideDictionary(kind, confirmHide.id)
            setConfirmHide(null)
            setNotice('Record hidden.')
            refresh()
          } catch (error) { setActionError(`Could not hide the record. ${errorMessage(error)}`) }
          finally { setBusyId('') }
        }}>{busyId ? 'Saving…' : 'Confirm'}</button>
        <button className="secondary" disabled={busyId !== ''} onClick={() => setConfirmHide(null)}>Cancel</button>
      </div>
    </section>}
    {loading && <p role="status">Loading dictionary…</p>}
    {!loading && !error && <div className="table-scroll">
      <table>
        <thead><tr>
          <th>Name</th>
          {kind === 'client' && <><th>Country</th><th>Industry</th><th>Contact person</th></>}
          {kind === 'product' && <th>Category</th>}
          {showHidden && <th>State</th>}
          <th></th>
        </tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td>{item.name}</td>
          {kind === 'client' && <>
            <td>{choiceLabel(clientCountries, item.country)}</td>
            <td>{choiceLabel(clientIndustries, item.industry)}</td>
            <td>{item.contact || '—'}</td>
          </>}
          {kind === 'product' && <td>{choiceLabel(productCategories, item.category)}</td>}
          {showHidden && <td>{item.statecode === 0 ? 'Active' : 'Hidden'}</td>}
          <td><div className="task-actions">
            <button className="secondary" disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={() => { setEditor(item); setNotice(''); setActionError(''); setConfirmHide(null) }}>Edit</button>
            {item.statecode === 0
              ? <button className="secondary" disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={() => { setConfirmHide(item); setActionError('') }}>Hide</button>
              : <button className="secondary" disabled={busyId !== '' || editor !== undefined || confirmHide !== null} onClick={async () => {
                setBusyId(item.id)
                setActionError('')
                try {
                  await restoreDictionary(kind, item.id)
                  setNotice('Record restored.')
                  refresh()
                } catch (error) { setActionError(`Could not restore the record. ${errorMessage(error)}`) }
                finally { setBusyId('') }
              }}>Restore</button>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
