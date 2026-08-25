import { useEffect, useState } from 'react'
import { Screen, Panel, Badge, Tag, Stat } from '../ui'
import { SAMPLE_TRACE, type ExecEventRow, type ExecEventType } from '../../mock/data'
import { useRuntimeStore } from '../../store/runtimeStore'
import { runtimeTraces, type RuntimeTrace } from '../../lib/api'

// Renders an execution trace — the fine-grained, per-turn timeline defined by
// agent-core's core.execution (ExecutionEvent / ExecutionTrace). Reads a running
// Runtime's /api/traces when reachable; falls back to sample data otherwise.

const TONE: Record<string, 'good' | 'info' | 'warn' | 'bad' | 'neutral'> = {
  TURN_STARTED: 'neutral',
  ROUTING_DECIDED: 'info',
  SKILL_SELECTED: 'info',
  GUARDRAIL_EVALUATED: 'warn',
  LLM_CALL: 'info',
  TOOL_CALLED: 'info',
  TOOL_RESULT: 'good',
  MEMORY_READ: 'neutral',
  MEMORY_WRITE: 'neutral',
  HANDOFF: 'info',
  TURN_COMPLETED: 'good',
  ERROR: 'bad',
}

function TraceItem({ e }: { e: ExecEventRow }) {
  return (
    <div className="trace-item">
      <div className="trace-head">
        <span>
          <span className="trace-seq">#{e.sequence}</span>{' '}
          <Badge tone={TONE[e.type] ?? 'neutral'}>{e.type}</Badge>
          {e.phase && <span className="trace-phase"> {e.phase}</span>}
        </span>
        {e.durationMs != null && <span className="trace-ms">{e.durationMs} ms</span>}
      </div>
      <div className="trace-msg">{e.message}</div>
      {e.attributes && Object.keys(e.attributes).length > 0 && (
        <div className="trace-attrs">
          {Object.entries(e.attributes).map(([k, v]) => (
            <Tag key={k}>
              {k}={String(v)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

type TraceView = { traceId: string; agentId: string; sessionId: string; events: ExecEventRow[] }

export function TraceExplorer() {
  const runtimeUrl = useRuntimeStore((s) => s.runtimeUrl)
  const setRuntimeUrl = useRuntimeStore((s) => s.setRuntimeUrl)
  const [traces, setTraces] = useState<RuntimeTrace[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [live, setLive] = useState(false)

  const load = () => {
    runtimeTraces(runtimeUrl)
      .then((t) => {
        setTraces(t)
        setLive(true)
        setSelected(0)
      })
      .catch(() => {
        setTraces(null)
        setLive(false)
      })
  }

  useEffect(load, [runtimeUrl])

  const trace: TraceView =
    live && traces && traces.length > 0
      ? (traces[Math.min(selected, traces.length - 1)] as TraceView)
      : (SAMPLE_TRACE as TraceView)

  const total = trace.events.reduce((sum, e) => sum + (e.durationMs ?? 0), 0)
  const errors = trace.events.filter((e) => e.type === ('ERROR' as ExecEventType)).length
  const toolCalls = trace.events.filter((e) => e.type === ('TOOL_CALLED' as ExecEventType)).length

  return (
    <Screen
      title="Trace Explorer"
      subtitle="The per-turn execution timeline (agent-core core.execution), read from a running Runtime's /api/traces."
      actions={
        <div className="pg-controls">
          <input
            type="text"
            value={runtimeUrl}
            onChange={(e) => setRuntimeUrl(e.target.value)}
            className="mono"
            style={{ width: 200 }}
          />
          <button onClick={load}>Refresh</button>
          <Badge tone={live ? 'good' : 'neutral'}>{live ? 'live' : 'sample data'}</Badge>
        </div>
      }
    >
      <div className="statrow">
        <Stat label="Events" value={trace.events.length} />
        <Stat label="Tool calls" value={toolCalls} />
        <Stat label="Duration" value={`${total} ms`} />
        <Stat label="Errors" value={errors} tone={errors > 0 ? 'bad' : 'good'} />
      </div>

      {live && traces && traces.length > 1 && (
        <div className="pg-controls">
          <span className="dim sm">Trace:</span>
          <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
            {traces.map((t, i) => (
              <option key={t.traceId} value={i}>
                {t.traceId.slice(0, 8)} · {t.events.length} events
              </option>
            ))}
          </select>
        </div>
      )}

      <Panel
        title={`Trace ${trace.traceId}`}
        actions={
          <span className="mono dim">
            {trace.agentId} · {trace.sessionId}
          </span>
        }
      >
        <div className="trace">
          {trace.events.map((e) => (
            <TraceItem key={e.sequence} e={e} />
          ))}
        </div>
      </Panel>
    </Screen>
  )
}
