import { useState } from 'react'
import { PLAYGROUND_CONVERSATION } from '../../mock/data'
import { Screen, Panel, Badge } from '../ui'

export function Playground() {
  const [showTrace, setShowTrace] = useState(true)
  const toolTurns = PLAYGROUND_CONVERSATION.filter((t) => t.tool)

  return (
    <Screen
      title="Playground"
      subtitle="Test conversations against a workload, with a live tool-call trace."
      actions={
        <div className="pg-controls">
          <select defaultValue="customer-agent:1.2.0">
            <option>customer-agent:1.2.0</option>
            <option>customer-agent:1.1.0</option>
            <option>fraud-agent:0.9.1</option>
          </select>
          <button className={showTrace ? 'toggle on' : 'toggle'} onClick={() => setShowTrace((s) => !s)}>
            Trace
          </button>
        </div>
      }
    >
      <div className={showTrace ? 'split-2' : 'split-1'}>
        <Panel title="Conversation">
          <div className="chat">
            {PLAYGROUND_CONVERSATION.map((t, i) => (
              <div key={i} className={`bubble ${t.role}`}>
                {t.skill && <span className="bubble-skill mono">{t.skill}</span>}
                <div className="bubble-text">{t.text}</div>
                {t.tool && (
                  <div className="bubble-tool">
                    <span className="mono">⚙ {t.tool.name}()</span> · {t.tool.ms}ms
                  </div>
                )}
              </div>
            ))}
            <div className="chat-input">
              <input type="text" placeholder="Send a message…" />
              <button className="primary">Send</button>
            </div>
          </div>
        </Panel>

        {showTrace && (
          <Panel title="Tool trace" actions={<Badge tone="info">{toolTurns.length} calls</Badge>}>
            <div className="trace">
              {toolTurns.map((t, i) => (
                <div className="trace-item" key={i}>
                  <div className="trace-head">
                    <span className="mono strong">{t.tool!.name}</span>
                    <span className="trace-ms">{t.tool!.ms}ms</span>
                  </div>
                  <div className="trace-io">
                    <span className="trace-k">args</span>
                    <pre className="code sm"><code>{t.tool!.args}</code></pre>
                  </div>
                  <div className="trace-io">
                    <span className="trace-k">result</span>
                    <pre className="code sm"><code>{t.tool!.result}</code></pre>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </Screen>
  )
}
