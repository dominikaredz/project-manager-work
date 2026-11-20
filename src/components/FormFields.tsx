import type { Option } from '../data/projects'

export function LookupField({ label, value, options, onChange, required = false }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; required?: boolean
}) {
  return <label>{label}{required && ' *'}
    <select value={value} onChange={event => onChange(event.target.value)} required={required}>
      <option value="">Select…</option>
      {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
  </label>
}

export function ChoiceField<T extends number>({ label, value, labels, onChange }: {
  label: string; value: T; labels: Readonly<Partial<Record<number, string>>>; onChange: (value: T) => void
}) {
  return <label>{label}
    <select value={value} onChange={event => {
      const selected = Number(event.target.value)
      const key = (Object.keys(labels).map(Number) as T[]).find(option => option === selected)
      if (key !== undefined) onChange(key)
    }}>
      {Object.keys(labels).map(key => {
        const text = labels[Number(key)]
        return text === undefined ? null : <option key={key} value={key}>{text}</option>
      })}
    </select>
  </label>
}
