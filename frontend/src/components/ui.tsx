// Presentational primitives shared by the (mostly read-only, mocked) screens.
// Kept deliberately small and unstyled-by-prop so the screens read as data.

import type { ReactNode } from 'react'

export function Screen({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="screen-sub">{subtitle}</p>}
        </div>
        {actions && <div className="screen-actions">{actions}</div>}
      </div>
      <div className="screen-body">{children}</div>
    </div>
  )
}

export function Panel({
  title,
  actions,
  children,
  pad,
}: {
  title?: string
  actions?: ReactNode
  children: ReactNode
  pad?: boolean
}) {
  return (
    <div className="panel">
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3>{title}</h3>}
          {actions}
        </div>
      )}
      <div className={pad ? 'panel-body pad' : 'panel-body'}>{children}</div>
    </div>
  )
}

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'accent'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-badge ${tone}`}>{children}</span>
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={`dot ${tone}`} />
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="ui-tag">{children}</span>
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

// Horizontal meter, value 0..1. `invert` colours low-is-good metrics.
export function Bar({ value, invert }: { value: number; invert?: boolean }) {
  const pct = Math.round(value * 100)
  const good = invert ? value <= 0.05 : value >= 0.9
  const warn = invert ? value <= 0.1 : value >= 0.75
  const tone = good ? 'good' : warn ? 'warn' : 'bad'
  return (
    <div className="bar" title={`${pct}%`}>
      <span className={`bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      <span className="bar-num">{pct}%</span>
    </div>
  )
}

export function healthTone(h: 'healthy' | 'degraded' | 'offline'): Tone {
  return h === 'healthy' ? 'good' : h === 'degraded' ? 'warn' : 'bad'
}
