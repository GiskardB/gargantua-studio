import { useState, useEffect } from 'react'
import { AgentDesigner } from '../AgentDesigner'
import { AgentGraph } from '../AgentGraph'
import { ManifestPreview } from '../ManifestPreview'
import { Screen, Badge } from '../ui'
import { useDraftStore } from '../../store/draftStore'

type Tab = 'form' | 'graph'

// The one real, functional designer: it produces a live gargantua.ai/v1 manifest,
// built and validated by the backend against the shared model. The draft lives in a
// Zustand store, so the form, the graph view and the preview all share one source.
export function AgentDesignerScreen() {
  const draft = useDraftStore((s) => s.draft)
  const setDraft = useDraftStore((s) => s.setDraft)
  const loadSample = useDraftStore((s) => s.loadSample)
  const clear = useDraftStore((s) => s.clear)

  // Track whether the form is open (starts closed — user picks "New" or "Load sample")
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('form')

  // Support loading an existing workload for editing: ?workload=name:version in URL
  const [editingWorkload, setEditingWorkload] = useState<string | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const workload = params.get('workload')
    if (workload) {
      setEditingWorkload(workload)
      setFormOpen(true)
    }
  }, [])

  const startNew = () => {
    clear()
    setFormOpen(true)
  }

  // Landing state: no form open, no editing workload
  if (!formOpen && !editingWorkload) {
    return (
      <Screen
        title="Agent Designer"
        subtitle="Author an agent declaratively — the output is a valid gargantua.ai/v1 manifest."
        actions={
          <>
            <button className="primary" onClick={startNew}>+ New Agent</button>
            <button onClick={() => { loadSample(); setFormOpen(true) }} style={{ marginLeft: 8 }}>
              Load sample
            </button>
          </>
        }
      >
        <div className="agent-split">
          <div className="agent-editor">
            <div className="welcome-state">
              <div className="welcome-icon">▰▰</div>
              <h2>Create your first agent</h2>
              <p>Start from scratch or load a sample to see how it works.</p>
              <div className="welcome-actions">
                <button className="primary" onClick={startNew}>+ New Agent</button>
                <button onClick={() => { loadSample(); setFormOpen(true) }} style={{ marginLeft: 12 }}>
                  Load sample
                </button>
              </div>
              <div className="welcome-hint">
                <p>Or go to <strong>Workload Designer</strong> to see published agents and click one to edit it.</p>
              </div>
            </div>
          </div>
          <div className="agent-preview">
            <ManifestPreview draft={draft} />
          </div>
        </div>
      </Screen>
    )
  }

  // Form open (new, sample, or editing existing)
  return (
    <Screen
      title={editingWorkload ? `Editing: ${editingWorkload}` : 'Agent Designer'}
      subtitle="Author an agent declaratively — the output is a valid gargantua.ai/v1 manifest."
      actions={
        <>
          <div className="tabs">
            <button className={tab === 'form' ? 'tab on' : 'tab'} onClick={() => setTab('form')}>
              Form
            </button>
            <button className={tab === 'graph' ? 'tab on' : 'tab'} onClick={() => setTab('graph')}>
              Graph
            </button>
          </div>
          <button onClick={clear}>Clear</button>
        </>
      }
    >
      {editingWorkload && (
        <div style={{ marginBottom: 12 }}>
          <Badge tone="neutral">Editing: {editingWorkload}</Badge>
        </div>
      )}
      <div className="agent-split">
        <div className="agent-editor">
          {tab === 'form' ? (
            <AgentDesigner draft={draft} onChange={setDraft} />
          ) : (
            <AgentGraph draft={draft} />
          )}
        </div>
        <div className="agent-preview">
          <ManifestPreview draft={draft} />
        </div>
      </div>
    </Screen>
  )
}
