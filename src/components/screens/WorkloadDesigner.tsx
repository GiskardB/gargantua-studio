import { WORKLOADS, type DeployState, type WorkloadKind } from '../../mock/data'
import { Screen, Badge, Dot, healthTone, type Tone } from '../ui'

const KIND_TONE: Record<WorkloadKind, Tone> = {
  AGENT: 'accent',
  WORKFLOW: 'info',
  EVALUATOR: 'warn',
  CLASSIFIER: 'info',
  SERVICE: 'neutral',
  BATCH_JOB: 'neutral',
}

const STATE_TONE: Record<DeployState, Tone> = {
  running: 'good',
  canary: 'warn',
  draft: 'neutral',
  stopped: 'bad',
}

export function WorkloadDesigner() {
  return (
    <Screen
      title="Workload Designer"
      subtitle="Every AI workload on the platform — agents, workflows, evaluators, services."
      actions={<button className="primary">+ New workload</button>}
    >
      <div className="cardgrid">
        {WORKLOADS.map((w) => (
          <div className="wl-card" key={`${w.name}:${w.version}`}>
            <div className="wl-top">
              <Badge tone={KIND_TONE[w.kind]}>{w.kind}</Badge>
              <span className="wl-health">
                <Dot tone={healthTone(w.health)} />
                {w.health}
              </span>
            </div>
            <div className="wl-name">{w.name}</div>
            <div className="wl-ver mono">v{w.version}</div>
            <div className="wl-meta">
              <span>{w.owner}</span>
              <span>·</span>
              <span>{w.capabilities} cap.</span>
            </div>
            <div className="wl-foot">
              <Badge tone={STATE_TONE[w.state]}>{w.state}</Badge>
              <span className="wl-updated">updated {w.updated}</span>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}
