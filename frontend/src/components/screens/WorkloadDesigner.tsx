import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WORKLOADS, type DeployState, type WorkloadKind } from '../../mock/data'
import { Screen, Badge, Dot, healthTone, type Tone } from '../ui'
import { usePlatformStore } from '../../store/platformStore'
import { deleteWorkload } from '../../lib/api'
import { LaunchDialog } from '../LaunchDialog'

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
  published: 'neutral',
  stopped: 'bad',
}

export function WorkloadDesigner() {
  const navigate = useNavigate()
  const live = usePlatformStore((s) => s.workloads)
  const source = usePlatformStore((s) => s.source)
  const refresh = usePlatformStore((s) => s.refresh)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [launchTarget, setLaunchTarget] = useState<{ name: string; version: string } | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Real published bundles when the backend is online; sample data otherwise.
  const workloads = live ?? WORKLOADS
  const isLive = source === 'live'

  async function handleDelete(name: string, version: string) {
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
                <span className="wl-updated">published {w.updated}</span>
              </div>
              <div className="wl-actions">
                <button
                  title="Open in Agent Designer to edit this workload"
                  onClick={() => navigate(`/agent?workload=${encodeURIComponent(`${w.name}:${w.version}`)}`)}
                >
                  Edit
                </button>
                <button
                  title="View the launch command and start this workload"
                  onClick={() => setLaunchTarget({ name: w.name, version: w.version })}
                >
                  Launch
                </button>
                {isLive && (
                  <button
                    className="danger"
                    title="Delete this published version"
                    disabled={deleting === `${w.name}:${w.version}`}
                    onClick={() => handleDelete(w.name, w.version)}
                  >
                    {deleting === `${w.name}:${w.version}` ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {launchTarget && (
        <LaunchDialog
          name={launchTarget.name}
          version={launchTarget.version}
          onClose={() => setLaunchTarget(null)}
        />
      )}
    </Screen>
  )
}
