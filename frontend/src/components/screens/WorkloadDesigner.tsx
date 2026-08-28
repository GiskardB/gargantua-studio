import { useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { WORKLOADS, type DeployState, type WorkloadKind } from '../../mock/data'
import { Screen, Badge, Dot, healthTone, type Tone } from '../ui'
import { usePlatformStore } from '../../store/platformStore'
import { deleteWorkload } from '../../lib/api'

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
  const navigate = useNavigate()
  const live = usePlatformStore((s) => s.workloads)
  const source = usePlatformStore((s) => s.source)
  const refresh = usePlatformStore((s) => s.refresh)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Real published bundles when the backend is online; sample data otherwise.
  const workloads = live ?? WORKLOADS
  const isLive = source === 'live'

  async function handleDelete(e: MouseEvent, name: string, version: string) {
    e.stopPropagation()
    if (!window.confirm(`Delete ${name}@${version}? This cannot be undone.`)) return
    setDeleting(`${name}:${version}`)
    setDeleteError(null)
    try {
      await deleteWorkload(name, version)
      await refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Screen
      title="Workload Designer"
      subtitle="Every AI workload on the platform — agents, workflows, evaluators, services."
      actions={
        <>
          <Badge tone={isLive ? 'good' : 'neutral'}>{isLive ? 'live' : 'sample data'}</Badge>
          <button className="primary" onClick={() => navigate('/agent')}>+ New workload</button>
        </>
      }
    >
      {deleteError && <div className="empty" style={{ color: 'var(--red)' }}>{deleteError}</div>}
      {workloads.length === 0 ? (
        <div className="empty">No workloads published yet. Publish one from the Agent Designer.</div>
      ) : (
        <div className="cardgrid">
          {workloads.map((w) => (
            <div
              className="wl-card"
              key={`${w.name}:${w.version}`}
              onClick={() => navigate(`/agent?workload=${encodeURIComponent(`${w.name}:${w.version}`)}`)}
            >
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
                {isLive && (
                  <button
                    className="link danger"
                    disabled={deleting === `${w.name}:${w.version}`}
                    onClick={(e) => handleDelete(e, w.name, w.version)}
                  >
                    {deleting === `${w.name}:${w.version}` ? 'deleting…' : 'delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}
