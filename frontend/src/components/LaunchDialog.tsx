// Launch dialog: shown from a workload card in the Workload Designer. Displays the
// exact (editable) command the Control Plane runs to start that bundle on a Runtime,
// lets you add extra environment variables without hand-editing that command, and can
// trigger the real launch — see the backend's LaunchService.

import { useEffect, useState } from 'react'
import { getLaunchCommand, setLaunchCommand, launchAgent, type LaunchResult } from '../lib/api'
import { usePlatformStore } from '../store/platformStore'

interface Props {
  name: string
  version: string
  onClose: () => void
}

interface EnvRow {
  key: string
  value: string
}

export function LaunchDialog({ name, version, onClose }: Props) {
  const [template, setTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<{ tone: string; text: string } | null>(null)
  const [result, setResult] = useState<LaunchResult | null>(null)
  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  // Every version of this agent shares one port (allocated once per name, see the
  // backend's LaunchService#allocatePort) — if it's ever been launched before, show the
  // real port; otherwise it's assigned the moment you actually launch.
  const knownPort = usePlatformStore((s) => s.deployments)?.find((d) => d.bundleName === name && d.port)?.port

  useEffect(() => {
    getLaunchCommand()
      .then((r) => setTemplate(r.template))
      .catch(() => setTemplate(''))
      .finally(() => setLoading(false))
  }, [])

  const activeEnvRows = envRows.filter((r) => r.key.trim())
  // Mirrors the backend's substitution (LaunchService) so the preview matches what will
  // actually run — no shell-quoting shown here, that's an execution detail, not a display one.
  const envFlags = activeEnvRows.map((r) => `-e ${r.key.trim()}=${r.value}`).join(' ')
  const command = template
    .replace('{name}', name)
    .replace('{version}', version)
    .replace('{env}', envFlags)
    .replace('{port}', knownPort ? String(knownPort) : '<assigned on launch>')
  const copy = () => void navigator.clipboard?.writeText(command)

  const saveTemplate = async () => {
    try {
      const r = await setLaunchCommand(template)
      setTemplate(r.template)
      setEditing(false)
    } catch (e) {
      setState({ tone: 'bad', text: e instanceof Error ? e.message : 'save failed' })
    }
  }

  const addEnvRow = () => setEnvRows((rows) => [...rows, { key: '', value: '' }])
  const updateEnvRow = (i: number, patch: Partial<EnvRow>) =>
    setEnvRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeEnvRow = (i: number) => setEnvRows((rows) => rows.filter((_, idx) => idx !== i))

  const launch = async () => {
    setState({ tone: 'info', text: `Launching ${name}@${version}…` })
    setResult(null)
    try {
      const env = Object.fromEntries(activeEnvRows.map((r) => [r.key.trim(), r.value]))
      const r = await launchAgent(name, version, env)
      setResult(r)
      setState(
        r.exitCode === 0
          ? { tone: 'good', text: `Launched — exit ${r.exitCode}` }
          : { tone: 'bad', text: `Launch failed — exit ${r.exitCode}` },
      )
    } catch (e) {
      setState({ tone: 'bad', text: e instanceof Error ? e.message : 'launch failed' })
    }
  }

  return (
    <div className="publish-dialog-overlay" onClick={onClose}>
      <div className="publish-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="publish-dialog-header">
          <span className="publish-dialog-title">Launch {name}@{version}</span>
          <button className="publish-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="publish-dialog-body">
          <p className="field-hint" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
            This is the exact command the Control Plane runs to start this workload on a Runtime.
          </p>
          {loading ? (
            <p className="empty">Loading command…</p>
          ) : editing ? (
            <div className="launch-edit">
              <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className="mono" />
              <p className="field-hint">{'{name}'}, {'{version}'}, {'{env}'} and {'{port}'} are substituted (validated) — {'{port}'} is allocated automatically per agent name.</p>
              <button className="primary" onClick={saveTemplate}>Save command</button>
            </div>
          ) : (
            <pre className="code sm"><code>{command}</code></pre>
          )}

          <div className="launch-env">
            <span className="field-label">Environment variables (optional)</span>
            {envRows.map((row, i) => (
              <div className="launch-env-row" key={i}>
                <input
                  placeholder="KEY"
                  value={row.key}
                  onChange={(e) => updateEnvRow(i, { key: e.target.value })}
                  className="mono"
                />
                <input
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateEnvRow(i, { value: e.target.value })}
                  className="mono"
                />
                <button className="link danger" onClick={() => removeEnvRow(i)} title="Remove">✕</button>
              </div>
            ))}
            <button className="add" onClick={addEnvRow}>+ Add variable</button>
          </div>

          {state && <div className={`publish-note ${state.tone}`}>{state.text}</div>}
          {result && (
            <>
              <p className="field-hint">Command actually run (port now assigned):</p>
              <pre className="code sm"><code>{result.command}</code></pre>
              <pre className="code sm"><code>{result.output || '(no output)'}</code></pre>
            </>
          )}
        </div>
        <div className="publish-dialog-actions">
          <button onClick={copy}>Copy</button>
          <button onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel edit' : 'Edit command'}</button>
          <button className="primary" onClick={launch}>Launch agent</button>
        </div>
      </div>
    </div>
  )
}
