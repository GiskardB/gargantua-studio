// Manifest YAML display: copy/export and the publish result note. Build state
// (yaml/errors/source) and the publish action itself live in the screen (via
// lib/useManifestPreview) so the "Save & Publish" button can sit in the screen's
// action bar while this stays a plain, single-purpose presentational panel.
// Launching a published workload happens from the Workload Designer, not here.

import type { PublishNote } from '../lib/useManifestPreview'
import { CodeEditor } from './CodeEditor'

interface Props {
  yaml: string
  errors: string[]
  source: 'backend' | 'local'
  filename: string
  publishState: PublishNote | null
  /** Renders a small collapse button to the left of the header when set. */
  onCollapse?: () => void
}

export function ManifestPreview({ yaml, errors, source, filename, publishState, onCollapse }: Props) {
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
        <div className="preview-head-left">
          {onCollapse && (
            <button className="preview-collapse-btn" onClick={onCollapse} title="Hide manifest.yaml">«</button>
          )}
          <h2>manifest.yaml</h2>
        </div>
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
