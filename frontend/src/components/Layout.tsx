import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  { to: '/playground', label: 'Playground', group: 'Test' },
  { to: '/trace', label: 'Trace Explorer', group: 'Test' },
  { to: '/evaluation', label: 'Evaluation Studio', group: 'Test' },
  { to: '/gateway', label: 'Gateway Designer', group: 'Govern' },
  { to: '/security', label: 'Security Designer', group: 'Govern' },
  { to: '/control-plane', label: 'Control Plane Status', group: 'System' },
  { to: '/settings', label: 'Settings', group: 'System' },
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
      <span className="conn-dot" /> <span className="conn-label">{state}</span>
    </span>
  )
}

// Clicking through to /control-plane is the "verify what's happening" affordance the
// pill alone can't give — a dot only says up/down, the page says what's deployed where.
function ControlPlanePill() {
  const online = usePlatformStore((s) => s.online)
  const cpOnline = usePlatformStore((s) => s.cpOnline)

  const state = online === false || cpOnline === null ? 'unknown' : cpOnline ? 'online' : 'offline'
  const tone = state === 'unknown' ? 'neutral' : state === 'online' ? 'good' : 'bad'
  return (
    <NavLink to="/control-plane" className={`conn-pill ${tone}`} title="Control Plane connectivity — click for status">
      <span className="conn-dot" /> <span className="conn-label">control plane: {state}</span>
    </NavLink>
  )
}

export function Layout() {
  const groups = [...new Set(NAV.map((n) => n.group))]
  // Below the mobile breakpoint the rail becomes an off-canvas drawer, toggled by the
  // hamburger button (hidden on wider screens, where the rail is always visible).
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="hamburger"
            onClick={() => setNavOpen((v) => !v)}
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
          >
            ☰
          </button>
          <div className="brand">
            <span className="logo">▰</span>
            <span>
              Gargantua <strong>Studio</strong>
            </span>
          </div>
        </div>
        <div className="topbar-right">
          <ConnectivityPill />
          <ControlPlanePill />
          <span className="env-pill">
            tenant: <strong>acme-bank</strong> · prod
          </span>
          <span className="avatar">GB</span>
        </div>
      </header>

      <div className="layout">
        {navOpen && <div className="rail-backdrop" onClick={() => setNavOpen(false)} />}
        <nav className={navOpen ? 'rail open' : 'rail'}>
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
