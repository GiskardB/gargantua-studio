import { useState } from 'react'
import type { AgentDraft } from './types/draft'
import { emptyDraft, sampleDraft } from './types/draft'
import { AgentDesigner } from './components/AgentDesigner'
import { ManifestPreview } from './components/ManifestPreview'

// The Studio shell. For the MVP there is exactly one designer (Agent) and one
// output (the manifest). The left rail lists the platform's designers with the
// unbuilt ones disabled, so the scope is legible without pretending they exist.
const DESIGNERS = [
  { id: 'agent', label: 'Agent Designer', ready: true },
  { id: 'capability', label: 'Capability Designer', ready: false },
  { id: 'workload', label: 'Workload Designer', ready: false },
  { id: 'playground', label: 'Playground', ready: false },
  { id: 'evaluation', label: 'Evaluation Studio', ready: false },
  { id: 'gateway', label: 'Gateway Designer', ready: false },
  { id: 'security', label: 'Security Designer', ready: false },
]

export default function App() {
  const [draft, setDraft] = useState<AgentDraft>(() => sampleDraft())

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▰</span>
          <span>Gargantua <strong>Studio</strong></span>
          <span className="tag">Agent Designer · gargantua.ai/v1</span>
        </div>
        <div className="topbar-actions">
          <button onClick={() => setDraft(sampleDraft())}>Load sample</button>
          <button onClick={() => setDraft(emptyDraft())}>Clear</button>
        </div>
      </header>

      <div className="layout">
        <nav className="rail">
          {DESIGNERS.map((d) => (
            <button key={d.id} className={d.ready ? 'rail-item on' : 'rail-item'} disabled={!d.ready} title={d.ready ? undefined : 'Not built yet'}>
              {d.label}
              {!d.ready && <span className="soon">soon</span>}
            </button>
          ))}
        </nav>

        <main className="editor">
          <AgentDesigner draft={draft} onChange={setDraft} />
        </main>

        <aside className="side">
          <ManifestPreview draft={draft} />
        </aside>
      </div>
    </div>
  )
}
