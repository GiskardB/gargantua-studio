// Live manifest preview + validation panel. Recomputes on every draft change:
// the draft is small, so building the manifest, validating and serializing on
// each keystroke is cheaper than memoization would be worth here.

import { useMemo } from 'react'
import type { AgentDraft } from '../types/draft'
import { buildManifest } from '../lib/buildManifest'
import { toYaml } from '../lib/toYaml'
import { validateDraft, errorCount, type Issue } from '../lib/validate'

interface Props {
  draft: AgentDraft
}

export function ManifestPreview({ draft }: Props) {
  const { yaml, issues, errors, filename } = useMemo(() => {
    const manifest = buildManifest(draft)
    const issues = validateDraft(draft)
    return {
      yaml: toYaml(manifest),
      issues,
      errors: errorCount(issues),
      filename: `${manifest.metadata.name || 'agent'}-manifest.yaml`,
    }
  }, [draft])

  const copy = () => {
    void navigator.clipboard?.writeText(yaml)
  }

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
          <span className={errors > 0 ? 'badge bad' : 'badge good'}>
            {errors > 0 ? `${errors} error${errors > 1 ? 's' : ''}` : 'valid'}
          </span>
          <button onClick={copy}>Copy</button>
          <button className="primary" onClick={download} disabled={errors > 0} title={errors > 0 ? 'Fix errors before exporting' : 'Download manifest.yaml'}>
            Export
          </button>
        </div>
      </div>

      {issues.length > 0 && <IssueList issues={issues} />}

      <pre className="yaml">
        <code>{yaml}</code>
      </pre>

      <p className="preview-foot">
        Validate the exported bundle with <code>gargantua validate</code> in the
        Runtime CLI. Schema: <code>gargantua.ai/v1</code>.
      </p>
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className="issues">
      {issues.map((issue, i) => (
        <li key={i} className={issue.severity}>
          <span className="issue-sev">{issue.severity}</span>
          <code className="issue-path">{issue.path}</code>
          <span className="issue-msg">{issue.message}</span>
        </li>
      ))}
    </ul>
  )
}
