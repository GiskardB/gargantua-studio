import { useRef, useState, useEffect } from 'react'
import { Screen, Panel, Badge } from '../ui'
import { useRuntimeStore, defaultRuntimeUrl } from '../../store/runtimeStore'
import { usePlatformStore } from '../../store/platformStore'
import { runtimeChat, RuntimeOfflineError, type RuntimeChatResponse } from '../../lib/api'
import { randomId } from '../../lib/randomId'

interface Turn {
  role: 'user' | 'agent'
  text: string
  meta?: RuntimeChatResponse
}

// Tests a conversation against a running Runtime's synchronous chat API. Unlike the rest
// of the Studio (which talks to the backend/Control Plane), this calls the Runtime
// directly — set its URL below. The Runtime must allow this origin (agent.web.cors).
export function Playground() {
  const runtimeUrl = useRuntimeStore((s) => s.runtimeUrl)
  const setRuntimeUrl = useRuntimeStore((s) => s.setRuntimeUrl)
  const deployments = usePlatformStore((s) => s.deployments)
  const refresh = usePlatformStore((s) => s.refresh)
  const cpOnline = usePlatformStore((s) => s.cpOnline)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Most published bundles were never launched anywhere — only deployments the Control
  // Plane has actually observed become HEALTHY are worth chatting with. Studio's Launch
  // action (Workload Designer) reports that state after it runs the launch command.
  // Most recently launched first, since only one runtime is reachable at a time.
  const activeAgents = (deployments ?? [])
    .filter((d) => d.state === 'HEALTHY')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const [selectedDeployment, setSelectedDeployment] = useState<string>('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Impersonation controls: set roles to test RBAC-gated skills (allowed-roles).
  const [userId, setUserId] = useState('studio-' + randomId().slice(0, 8))
  const [roles, setRoles] = useState('')
  // Stable session id so multi-turn memory works within a Playground session.
  const session = useRef(randomId())
  const selected = activeAgents.find((d) => d.id === selectedDeployment)

  // Auto-populate runtime URL when an active agent is selected and URL is empty/default
  useEffect(() => {
    if (selected && !runtimeUrl) {
      setRuntimeUrl(defaultRuntimeUrl())
    }
  }, [selected, runtimeUrl, setRuntimeUrl])

  const send = async () => {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setError(null)
    setTurns((t) => [...t, { role: 'user', text: message }])
    setSending(true)
    try {
      const res = await runtimeChat(runtimeUrl, message, userId, session.current, roles)
      setTurns((t) => [...t, { role: 'agent', text: res.text, meta: res }])
    } catch (e) {
      const msg = e instanceof RuntimeOfflineError ? `Runtime offline at ${runtimeUrl}` : (e as Error).message
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <Screen
      title="Playground"
      subtitle="Test a conversation against a running Runtime. Set the Runtime URL, then chat — responses show the real skill, routing method and token counts."
      actions={
        <>
          <div className="pg-controls">
            <select
              value={selectedDeployment}
              onChange={(e) => setSelectedDeployment(e.target.value)}
              className="mono"
              style={{ width: 240, marginRight: 12 }}
            >
              <option value="">
                {activeAgents.length === 0 ? '— No active agents —' : '— Select active agent —'}
              </option>
              {activeAgents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.bundleName} v{d.bundleVersion} ({d.environment})
                </option>
              ))}
            </select>
            {selected && <Badge tone="good">Testing: {selected.bundleName}</Badge>}
            {activeAgents.length === 0 && (
              <span className="dim" style={{ fontSize: 12 }}>
                {cpOnline === false
                  ? 'Control Plane offline — cannot check for active agents.'
                  : 'No agents are currently running — launch one from the Workload Designer.'}
              </span>
            )}
          </div>
          <div className="pg-controls">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user id"
              className="mono"
              style={{ width: 130 }}
              title="X-User-Id sent to the runtime"
            />
            <input
              type="text"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              placeholder="roles (for RBAC)"
              className="mono"
              style={{ width: 150 }}
              title="X-User-Roles — comma-separated; needed to reach a skill with allowed-roles"
            />
            <input
              type="text"
              value={runtimeUrl}
              onChange={(e) => setRuntimeUrl(e.target.value)}
              placeholder="http://localhost:18100"
              className="mono"
              style={{ width: 220 }}
            />
          </div>
        </>
      }
    >
      <Panel title="Conversation">
        <div className="chat">
          {turns.length === 0 && (
            <p className="empty">No messages yet — send one to test the launched agent.</p>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`bubble ${t.role}`}>
              {t.meta && <span className="bubble-skill mono">{t.meta.skillUsed} · {t.meta.routingMethod}</span>}
              <div className="bubble-text">{t.text}</div>
              {t.meta && (
                <div className="bubble-tool">
                  {t.meta.totalTokens} tokens · {t.meta.durationMs}ms
                  {t.meta.toolsCalled.length > 0 && ` · tools: ${t.meta.toolsCalled.join(', ')}`}
                </div>
              )}
            </div>
          ))}
          {sending && <div className="bubble agent"><div className="bubble-text dim">…</div></div>}
          {error && <div className="publish-note bad">{error}</div>}
          <div className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Send a message…"
              disabled={sending}
            />
            <button className="primary" onClick={send} disabled={sending || !input.trim()}>Send</button>
          </div>
        </div>
      </Panel>
    </Screen>
  )
}
