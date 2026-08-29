// Launch dialog: shown from a workload card in the Workload Designer. Displays the
// exact (editable) command the Control Plane runs to start that bundle on a Runtime,
// and can trigger the real launch — see the backend's LaunchService.

import { useEffect, useState } from 'react'
import { getLaunchCommand, setLaunchCommand, launchAgent, type LaunchResult } from '../lib/api'

interface Props {
  name: string
  version: string
  onClose: () => void
}

export function LaunchDialog({ name, version, onClose }: Props) {
  const [template, setTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<{ tone: string; text: string } | null>(null)
  const [result, setResult] = useState<LaunchResult | null>(null)

  useEffect(() => {
    getLaunchCommand()
      .then((r) => setTemplate(r.template))
      .catch(() => setTemplate(''))
      .finally(() => setLoading(false))
  }, [])

  const command = template.replace('{name}', name).replace('{version}', version)
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

  const launch = async () => {
    setState({ tone: 'info', text: `Launching ${name}@${version}…` })
    setResult(null)
    try {
      const r = await launchAgent(name, version)
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
              <p className="field-hint">{'{name}'} and {'{version}'} are substituted (validated).</p>
              <button className="primary" onClick={saveTemplate}>Save command</button>
            </div>
          ) : (
            <pre className="code sm"><code>{command}</code></pre>
          )}
          {state && <div className={`publish-note ${state.tone}`}>{state.text}</div>}
          {result && <pre className="code sm"><code>{result.output || '(no output)'}</code></pre>}
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
