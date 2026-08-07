import { useState } from 'react'
import { AgentDesigner } from '../AgentDesigner'
import { AgentGraph } from '../AgentGraph'
import { ManifestPreview } from '../ManifestPreview'
import { Screen } from '../ui'
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
  const [tab, setTab] = useState<Tab>('form')

  return (
    <Screen
      title="Agent Designer"
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
          <button onClick={loadSample}>Load sample</button>
          <button onClick={clear}>Clear</button>
        </>
      }
    >
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
