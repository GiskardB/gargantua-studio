import { ROLES, APP_CLIENTS, TENANTS } from '../../mock/data'
import { Screen, Panel, Badge, Tag, type Tone } from '../ui'

const ENV_TONE: Record<string, Tone> = { prod: 'bad', staging: 'warn', dev: 'info' }

export function SecurityDesigner() {
  return (
    <Screen
      title="Security Designer"
      subtitle="RBAC, tenants, authorized applications and data policy."
      actions={<button className="primary">+ New role</button>}
    >
      <div className="split-sidebar">
        <Panel title="Tenants">
          <ul className="list">
            {TENANTS.map((t, i) => (
              <li key={i} className="list-row">
                <div>
                  <div className="mono">{t.name}</div>
                  <div className="dim sm">{t.workloads} workloads</div>
                </div>
                <Badge tone={ENV_TONE[t.environment]}>{t.environment}</Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Roles">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Permissions</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.name}>
                  <td><Badge tone="accent">{r.name}</Badge></td>
                  <td className="dim">{r.description}</td>
                  <td className="tags">
                    {r.permissions.map((p) => <Tag key={p}>{p}</Tag>)}
                  </td>
                  <td className="mono">{r.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Authorized applications">
        <table className="table">
          <thead>
            <tr>
              <th>Application</th>
              <th>Client ID</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {APP_CLIENTS.map((a) => (
              <tr key={a.clientId}>
                <td>{a.name}</td>
                <td className="mono dim">{a.clientId}</td>
                <td className="tags">{a.roles.map((r) => <Tag key={r}>{r}</Tag>)}</td>
                <td><Badge tone={a.status === 'active' ? 'good' : 'bad'}>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Screen>
  )
}
