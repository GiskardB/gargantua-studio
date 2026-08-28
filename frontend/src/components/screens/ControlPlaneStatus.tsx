import { useEffect } from 'react'
import { usePlatformStore, type DeploymentState } from '../../store/platformStore'
import { Screen, Panel, Badge, Dot, type Tone } from '../ui'

const STATE_TONE: Record<DeploymentState, Tone> = {
  PENDING: 'neutral',
  PROGRESSING: 'warn',
  HEALTHY: 'good',
  FAILED: 'bad',
}

// What's actually happening on the Control Plane: is it reachable, and what did it
// last report for every deployment (bundle × environment). Read-only — deployments
// are created by publishing/launching from the Agent Designer, not from here.
export function ControlPlaneStatus() {
  const online = usePlatformStore((s) => s.online)
  const cpOnline = usePlatformStore((s) => s.cpOnline)
  const workloads = usePlatformStore((s) => s.workloads)
  const deployments = usePlatformStore((s) => s.deployments)
  const refresh = usePlatformStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const reachable = online && cpOnline

  return (
    <Screen
      title="Control Plane"
      subtitle="Live connectivity and deployment state as the Control Plane reports it."
      actions={
        <Badge tone={reachable ? 'good' : 'bad'}>
          {online === null ? 'checking…' : !online ? 'studio backend offline' : cpOnline ? 'reachable' : 'unreachable'}
        </Badge>
      }
    >
      <Panel title="Deployments">
        {!reachable ? (
          <div className="empty">
            Control Plane is unreachable — nothing to show. Publishing and deployment status
            will resume once it's back.
          </div>
        ) : !deployments || deployments.length === 0 ? (
          <div className="empty">No deployments yet. Launch a published workload from the Agent Designer.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Bundle</th>
                <th>Version</th>
                <th>Environment</th>
                <th>Strategy</th>
                <th>State</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id}>
                  <td>{d.bundleName}</td>
                  <td className="mono">{d.bundleVersion}</td>
                  <td>{d.environment}</td>
                  <td>{d.strategy}</td>
                  <td>
                    <Dot tone={STATE_TONE[d.state]} /> <Badge tone={STATE_TONE[d.state]}>{d.state}</Badge>
                  </td>
                  <td>{d.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Published workloads">
        {!reachable || !workloads ? (
          <div className="empty">—</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Version</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => (
                <tr key={`${w.name}:${w.version}`}>
                  <td>{w.name}</td>
                  <td>{w.kind}</td>
                  <td className="mono">{w.version}</td>
                  <td>{w.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Screen>
  )
}
