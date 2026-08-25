import { useState } from 'react'
import { GATEWAY_ROUTES } from '../../mock/data'
import { Screen, Panel, Badge, type Tone } from '../ui'

const STRATEGY_TONE: Record<string, Tone> = {
  stable: 'good',
  'canary 10%': 'warn',
  'blue/green': 'info',
}

// A tiny mock intent resolver: first route whose sample intent shares a keyword.
function resolve(input: string) {
  const q = input.toLowerCase()
  const words = q.split(/\s+/).filter((w) => w.length > 3)
  return (
    GATEWAY_ROUTES.find((r) => words.some((w) => r.intent.toLowerCase().includes(w))) ?? null
  )
}

export function GatewayDesigner() {
  const [input, setInput] = useState('vorrei contestare un pagamento sospetto')
  const match = resolve(input)

  return (
    <Screen
      title="Gateway Designer"
      subtitle="Route requests by capability, not by agent name. Configure intent routing, versions, limits."
      actions={<button className="primary">+ New route</button>}
    >
      <Panel title="Test intent routing" pad>
        <div className="intent-test">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder='e.g. "voglio un rimborso"' />
          <div className="intent-arrow">→</div>
          {match ? (
            <div className="intent-result">
              <Badge tone="accent">{match.capability}</Badge>
              <span className="intent-to">routes to</span>
              <span className="mono strong">{match.target}</span>
            </div>
          ) : (
            <div className="intent-result dim">no matching capability</div>
          )}
        </div>
      </Panel>

      <Panel title="Routes">
        <table className="table">
          <thead>
            <tr>
              <th>Intent</th>
              <th>Capability</th>
              <th>Target</th>
              <th>Strategy</th>
              <th>Rate limit</th>
              <th>Auth</th>
            </tr>
          </thead>
          <tbody>
            {GATEWAY_ROUTES.map((r) => (
              <tr key={r.intent} className={match?.intent === r.intent ? 'row-best' : ''}>
                <td className="dim">{r.intent}</td>
                <td className="mono">{r.capability}</td>
                <td className="mono">{r.target}</td>
                <td><Badge tone={STRATEGY_TONE[r.strategy] ?? 'neutral'}>{r.strategy}</Badge></td>
                <td className="mono">{r.rateLimit}</td>
                <td><Badge tone="neutral">{r.auth}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Screen>
  )
}
