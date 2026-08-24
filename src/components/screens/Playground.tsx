import { useRef, useState } from 'react'
import { Screen, Panel } from '../ui'
import { useRuntimeStore } from '../../store/runtimeStore'
import { runtimeChat, RuntimeOfflineError, type RuntimeChatResponse } from '../../lib/api'

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
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stable per-session ids so multi-turn memory works within a Playground session.
  const ids = useRef({ user: 'studio-' + crypto.randomUUID().slice(0, 8), session: crypto.randomUUID() })

  const send = async () => {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setError(null)
    setTurns((t) => [...t, { role: 'user', text: message }])
    setSending(true)
    try {
      const res = await runtimeChat(runtimeUrl, message, ids.current.user, ids.current.session)
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
        <div className="pg-controls">
          <input
            type="text"
            value={runtimeUrl}
            onChange={(e) => setRuntimeUrl(e.target.value)}
            placeholder="http://localhost:18100"
            className="mono"
            style={{ width: 240 }}
          />
        </div>
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
