import { Screen, Panel, Badge, Tag, Stat } from '../ui'
import { SAMPLE_TRACE, type ExecEventRow, type ExecEventType } from '../../mock/data'

// Renders an execution trace — the fine-grained, per-turn timeline defined by
// agent-core's core.execution (ExecutionEvent / ExecutionTrace). This is the offline
// preview of the observability view; once the Runtime emits events through the
// ExecutionEventPublisher port and exposes a trace API, this screen reads that instead.

const TONE: Record<ExecEventType, 'good' | 'info' | 'warn' | 'bad' | 'neutral'> = {
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
          <Badge tone={TONE[e.type]}>{e.type}</Badge>
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

export function TraceExplorer() {
  const trace = SAMPLE_TRACE
  const total = trace.events.reduce((sum, e) => sum + (e.durationMs ?? 0), 0)
  const errors = trace.events.filter((e) => e.type === 'ERROR').length
  const toolCalls = trace.events.filter((e) => e.type === 'TOOL_CALLED').length

  return (
    <Screen
      title="Trace Explorer"
      subtitle="The per-turn execution timeline (agent-core core.execution). Sample data until the Runtime streams events through the ExecutionEventPublisher port."
      actions={<Badge tone="neutral">sample data</Badge>}
    >
      <div className="statrow">
        <Stat label="Events" value={trace.events.length} />
        <Stat label="Tool calls" value={toolCalls} />
        <Stat label="Duration" value={`${total} ms`} />
        <Stat label="Errors" value={errors} tone={errors > 0 ? 'bad' : 'good'} />
      </div>

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
