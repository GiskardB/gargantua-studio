import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { usePlatformStore } from '../store/platformStore'

interface NavItem {
  to: string
  label: string
  group: string
  live?: boolean
}

// Grouped to mirror the lifecycle: design → test → govern.
const NAV: NavItem[] = [
  { to: '/workload', label: 'Workload Designer', group: 'Design' },
  { to: '/agent', label: 'Agent Designer', group: 'Design', live: true },
  { to: '/skill', label: 'Skill Designer', group: 'Design', live: true },
  { to: '/capability', label: 'Capability Designer', group: 'Design' },
  { to: '/playground', label: 'Playground', group: 'Test' },
  { to: '/trace', label: 'Trace Explorer', group: 'Test' },
  { to: '/evaluation', label: 'Evaluation Studio', group: 'Test' },
  { to: '/gateway', label: 'Gateway Designer', group: 'Govern' },
  { to: '/security', label: 'Security Designer', group: 'Govern' },
]

function ConnectivityPill() {
  const online = usePlatformStore((s) => s.online)
  const refresh = usePlatformStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 15000)
    return () => clearInterval(timer)
  }, [refresh])

  const state = online === null ? 'connecting' : online ? 'online' : 'offline'
  const tone = online === null ? 'neutral' : online ? 'good' : 'bad'
  return (
    <span className={`conn-pill ${tone}`} title="Studio backend connectivity">
      <span className="conn-dot" /> {state}
    </span>
  )
}

export function Layout() {
  const groups = [...new Set(NAV.map((n) => n.group))]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▰</span>
          <span>
            Gargantua <strong>Studio</strong>
          </span>
        </div>
        <div className="topbar-right">
          <ConnectivityPill />
          <span className="env-pill">
            tenant: <strong>acme-bank</strong> · prod
          </span>
          <span className="avatar">GB</span>
        </div>
      </header>

      <div className="layout">
        <nav className="rail">
          {groups.map((g) => (
            <div className="rail-group" key={g}>
              <div className="rail-group-title">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) => (isActive ? 'rail-item on' : 'rail-item')}
                >
                  <span>{n.label}</span>
                  {n.live && (
                    <span className="live" title="Backed by real manifest logic">
                      live
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="rail-foot">
            <div className="rail-foot-k">schema</div>
            <div className="mono">gargantua.ai/v1</div>
          </div>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
