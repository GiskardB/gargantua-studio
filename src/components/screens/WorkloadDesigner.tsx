import { useEffect } from 'react'
import { WORKLOADS, type DeployState, type WorkloadKind } from '../../mock/data'
import { Screen, Badge, Dot, healthTone, type Tone } from '../ui'
import { usePlatformStore } from '../../store/platformStore'

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
  const live = usePlatformStore((s) => s.workloads)
  const source = usePlatformStore((s) => s.source)
  const refresh = usePlatformStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Real published bundles when the backend is online; sample data otherwise.
  const workloads = live ?? WORKLOADS
  const isLive = source === 'live'

  return (
    <Screen
      title="Workload Designer"
      subtitle="Every AI workload on the platform — agents, workflows, evaluators, services."
      actions={
        <>
          <Badge tone={isLive ? 'good' : 'neutral'}>{isLive ? 'live' : 'sample data'}</Badge>
          <button className="primary">+ New workload</button>
        </>
      }
    >
      {workloads.length === 0 ? (
        <div className="empty">No workloads published yet. Publish one from the Agent Designer.</div>
      ) : (
        <div className="cardgrid">
          {workloads.map((w) => (
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
      )}
    </Screen>
  )
}
