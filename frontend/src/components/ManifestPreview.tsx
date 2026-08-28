// Manifest YAML display: copy/export and the post-publish Launch panel. Build state
// (yaml/errors/source) and the publish action itself live in the screen (via
// lib/useManifestPreview) so the "Save & Publish" button can sit in the screen's
// action bar while this stays a plain, single-purpose presentational panel.

import { useEffect, useState } from 'react'
import { getLaunchCommand, setLaunchCommand, launchAgent, type LaunchResult } from '../lib/api'
import type { PublishNote } from '../lib/useManifestPreview'
import { CodeEditor } from './CodeEditor'

interface Props {
  yaml: string
  errors: string[]
  source: 'backend' | 'local'
  filename: string
  publishState: PublishNote | null
  published: { name: string; version: string } | null
}

export function ManifestPreview({ yaml, errors, source, filename, publishState, published }: Props) {
  const valid = errors.length === 0

  const copy = () => void navigator.clipboard?.writeText(yaml)

  const download = () => {
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="preview">
      <div className="preview-head">
        <h2>manifest.yaml</h2>
        <div className="preview-actions">
          <span className={valid ? 'badge good' : 'badge bad'}>
            {valid ? 'valid' : `${errors.length} error${errors.length > 1 ? 's' : ''}`}
          </span>
          <span className="badge neutral" title="Which builder produced this YAML">
            {source === 'backend' ? 'backend' : 'offline'}
          </span>
          <button onClick={copy}>Copy</button>
          <button onClick={download} disabled={!valid}>Export</button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="issues">
          {errors.map((msg, i) => (
            <li key={i} className="error">
              <span className="issue-sev">error</span>
              <span className="issue-msg">{msg}</span>
            </li>
          ))}
        </ul>
      )}

      {publishState && <div className={`publish-note ${publishState.tone}`}>{publishState.text}</div>}

      {published && <LaunchPanel name={published.name} version={published.version} />}

      <div className="yaml-editor">
        <CodeEditor value={yaml} language="yaml" readOnly dark />
      </div>

      <p className="preview-foot">
        Built and validated by the Studio backend against the shared <code>agent-core</code>{' '}
        model. Schema: <code>gargantua.ai/v1</code>.
      </p>
    </div>
  )
}

// Shown after a successful publish: run the (editable) launch command for this bundle.
// The command starts a Runtime pointed at the published bundle — see the backend's
// LaunchService. Editing the template lets you swap docker for kubectl etc.
function LaunchPanel({ name, version }: { name: string; version: string }) {
  const [template, setTemplate] = useState('')
  const [editing, setEditing] = useState(false)
  const [state, setState] = useState<{ tone: string; text: string } | null>(null)
  const [result, setResult] = useState<LaunchResult | null>(null)

  useEffect(() => {
    getLaunchCommand().then((r) => setTemplate(r.template)).catch(() => setTemplate(''))
  }, [])

  const saveTemplate = async () => {
    try {
      const r = await setLaunchCommand(template)
      setTemplate(r.template)
      setEditing(false)
    } catch (e) {
      setState({ tone: 'bad', text: (e as Error).message })
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
      setState({ tone: 'bad', text: (e as Error).message })
    }
  }

  return (
    <div className="launch-panel">
      <div className="launch-head">
        <strong>Launch</strong>
        <div className="launch-actions">
          <button onClick={() => setEditing((e) => !e)}>{editing ? 'Cancel' : 'Edit command'}</button>
          <button className="primary" onClick={launch}>Launch agent</button>
        </div>
      </div>
      {editing ? (
        <div className="launch-edit">
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={4} className="mono" />
          <p className="field-hint">
            {'{name}'} and {'{version}'} are substituted (validated). Swap for kubectl etc. without a code change.
          </p>
          <button className="primary" onClick={saveTemplate}>Save command</button>
        </div>
      ) : (
        <pre className="code sm launch-cmd"><code>{template.replace('{name}', name).replace('{version}', version)}</code></pre>
      )}
      {state && <div className={`publish-note ${state.tone}`}>{state.text}</div>}
      {result && <pre className="code sm launch-output"><code>{result.output || '(no output)'}</code></pre>}
    </div>
  )
}
