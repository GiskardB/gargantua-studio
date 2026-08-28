// Minimal controlled form primitives. No form library — the draft is a plain
// object and these just render value/onChange pairs, which keeps the data flow
// obvious and the bundle tiny.

import type { ReactNode } from 'react'

export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {hint && <p className="hint">{hint}</p>}
      </div>
      <div className="section-body">{children}</div>
    </section>
  )
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="req" title="required"> *</span>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  list,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  /** Wires an HTML `<datalist id="...">` for suggestions without forcing one of them. */
  list?: string
}) {
  return (
    <input
      className={mono ? 'mono' : undefined}
      type="text"
      value={value}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
}) {
  return (
    <textarea
      className={mono ? 'mono' : undefined}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
