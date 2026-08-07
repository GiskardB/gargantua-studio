// Live manifest preview + validation. The backend is the authority: on every change
// the draft is sent to /manifest/build, which validates it against the shared agent-core
// model and returns the canonical YAML. When the backend is offline it falls back to the
// local builder so the Studio stays useful — the badge says which path produced the YAML.

import { useEffect, useRef, useState } from 'react'
import type { AgentDraft } from '../types/draft'
import { buildManifest as buildLocal } from '../lib/buildManifest'
import { toYaml } from '../lib/toYaml'
import { validateDraft } from '../lib/validate'
import { buildManifest as buildRemote, OfflineError, publishDraft } from '../lib/api'
import { CodeEditor } from './CodeEditor'

interface Props {
  draft: AgentDraft
}

type Source = 'backend' | 'local'

function localBuild(draft: AgentDraft): { yaml: string; errors: string[] } {
  const issues = validateDraft(draft)
  return {
    yaml: toYaml(buildLocal(draft)),
    errors: issues.filter((i) => i.severity === 'error').map((i) => `${i.path}: ${i.message}`),
  }
}

export function ManifestPreview({ draft }: Props) {
  const [yaml, setYaml] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [source, setSource] = useState<Source>('local')
  const [publishState, setPublishState] = useState<{ tone: string; text: string } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const timer = setTimeout(async () => {
      try {
        const res = await buildRemote(draft)
        if (id !== seq.current) return
        setSource('backend')
        setYaml(res.yaml ?? '')
        setErrors(res.errors)
      } catch {
        if (id !== seq.current) return
        // Backend down (or a non-offline error): fall back to the local builder.
        const local = localBuild(draft)
        setSource('local')
        setYaml(local.yaml)
        setErrors(local.errors)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [draft])

  const valid = errors.length === 0
  const filename = `${draft.metadata.name || 'agent'}-manifest.yaml`

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

  const publish = async () => {
    setPublishState({ tone: 'info', text: 'Publishing…' })
    try {
      await publishDraft(draft)
      setPublishState({
        tone: 'good',
        text: `Published ${draft.metadata.name}@${draft.metadata.version}`,
      })
    } catch (e) {
      const msg = e instanceof OfflineError ? 'Backend offline — cannot publish' : (e as Error).message
      setPublishState({ tone: 'bad', text: msg })
    }
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
          <button
            className="primary"
            onClick={publish}
            disabled={!valid || source !== 'backend'}
            title={source !== 'backend' ? 'Publishing needs the backend online' : 'Publish to the Control Plane'}
          >
            Publish
          </button>
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
        <CodeEditor value={yaml} language="yaml" readOnly />
      </div>

      <p className="preview-foot">
        Built and validated by the Studio backend against the shared <code>agent-core</code>{' '}
        model. Schema: <code>gargantua.ai/v1</code>.
      </p>
    </div>
  )
}
