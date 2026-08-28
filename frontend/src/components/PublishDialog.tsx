// Publish dialog: shown when clicking "Save & Publish" button. Lets the user
// add release notes before publishing to the Control Plane.

import { useState } from 'react'

interface Props {
  open: boolean
  title: string
  version: string
  onPublish: () => Promise<void>
  onCancel: () => void
}

export function PublishDialog({ open, title, version, onPublish, onCancel }: Props) {
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)
    try {
      await onPublish()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'publish failed')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="publish-dialog-overlay" onClick={onCancel}>
      <div className="publish-dialog" onClick={e => e.stopPropagation()}>
        <div className="publish-dialog-header">
          <span className="publish-dialog-title">Publish {title}</span>
          <button className="publish-dialog-close" onClick={onCancel}>✕</button>
        </div>
        <div className="publish-dialog-body">
          <div className="field">
            <label className="field-label">Version</label>
            <div className="mono">{version}</div>
          </div>
          <p className="field-hint" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
            This will publish the current agent manifest to the Control Plane registry.
            Download the bundle first if you want a local copy.
          </p>
          {error && (
            <div className="bad" style={{ padding: 8, marginBottom: 8 }}>{error}</div>
          )}
        </div>
        <div className="publish-dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handlePublish} disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}