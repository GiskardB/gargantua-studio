import { useState } from 'react'
import type { AgentDraft } from './types/draft'
import { sampleDraft } from './types/draft'
import { AgentDesignerScreen } from './components/screens/AgentDesignerScreen'
import { WorkloadDesigner } from './components/screens/WorkloadDesigner'
import { CapabilityDesigner } from './components/screens/CapabilityDesigner'
import { Playground } from './components/screens/Playground'
import { EvaluationStudio } from './components/screens/EvaluationStudio'
import { GatewayDesigner } from './components/screens/GatewayDesigner'
import { SecurityDesigner } from './components/screens/SecurityDesigner'

type ScreenId =
  | 'workload'
  | 'agent'
  | 'capability'
  | 'playground'
  | 'evaluation'
  | 'gateway'
  | 'security'

interface NavItem {
  id: ScreenId
  label: string
  group: string
  live?: boolean // backed by real logic vs mocked data
}

// Grouped to mirror the lifecycle: design → test → govern.
const NAV: NavItem[] = [
  { id: 'workload', label: 'Workload Designer', group: 'Design' },
  { id: 'agent', label: 'Agent Designer', group: 'Design', live: true },
  { id: 'capability', label: 'Capability Designer', group: 'Design' },
  { id: 'playground', label: 'Playground', group: 'Test' },
  { id: 'evaluation', label: 'Evaluation Studio', group: 'Test' },
  { id: 'gateway', label: 'Gateway Designer', group: 'Govern' },
  { id: 'security', label: 'Security Designer', group: 'Govern' },
]

export default function App() {
  const [active, setActive] = useState<ScreenId>('agent')
  const [draft, setDraft] = useState<AgentDraft>(() => sampleDraft())

  const groups = [...new Set(NAV.map((n) => n.group))]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▰</span>
          <span>Gargantua <strong>Studio</strong></span>
        </div>
        <div className="topbar-right">
          <span className="env-pill">tenant: <strong>acme-bank</strong> · prod</span>
          <span className="avatar">GB</span>
        </div>
      </header>

      <div className="layout">
        <nav className="rail">
          {groups.map((g) => (
            <div className="rail-group" key={g}>
              <div className="rail-group-title">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.id}
                  className={n.id === active ? 'rail-item on' : 'rail-item'}
                  onClick={() => setActive(n.id)}
                >
                  <span>{n.label}</span>
                  {n.live && <span className="live" title="Backed by real manifest logic">live</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="rail-foot">
            <div className="rail-foot-k">schema</div>
            <div className="mono">gargantua.ai/v1</div>
          </div>
        </nav>

        <main className="content">
          {active === 'agent' && <AgentDesignerScreen draft={draft} onChange={setDraft} />}
          {active === 'workload' && <WorkloadDesigner />}
          {active === 'capability' && <CapabilityDesigner />}
          {active === 'playground' && <Playground />}
          {active === 'evaluation' && <EvaluationStudio />}
          {active === 'gateway' && <GatewayDesigner />}
          {active === 'security' && <SecurityDesigner />}
        </main>
      </div>
    </div>
  )
}
