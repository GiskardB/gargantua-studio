import { EVAL_DATASETS, EVAL_RUNS } from '../../mock/data'
import { Screen, Panel, Bar, Stat } from '../ui'

export function EvaluationStudio() {
  const latest = EVAL_RUNS[0]
  return (
    <Screen
      title="Evaluation Studio"
      subtitle="Datasets, benchmarks and version comparison — accuracy, latency, cost, hallucination, tool success."
      actions={<button className="primary">Run evaluation</button>}
    >
      <div className="statrow">
        <Stat label="Accuracy" value={`${Math.round(latest.accuracy * 100)}%`} tone="good" />
        <Stat label="Tool success" value={`${Math.round(latest.toolSuccess * 100)}%`} tone="good" />
        <Stat label="Hallucination" value={`${Math.round(latest.hallucination * 100)}%`} tone="good" />
        <Stat label="p50 latency" value={`${latest.latencyMs}ms`} />
        <Stat label="Cost /1k" value={`$${latest.costUsd.toFixed(2)}`} />
      </div>

      <div className="split-sidebar">
        <Panel title="Datasets">
          <ul className="list">
            {EVAL_DATASETS.map((d) => (
              <li key={d.name} className="list-row">
                <div>
                  <div className="mono">{d.name}</div>
                  <div className="dim sm">{d.cases} cases · {d.updated}</div>
                </div>
                <button className="link">open</button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Version comparison — refund-golden-set">
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Accuracy</th>
                <th>Tool success</th>
                <th>Hallucination</th>
                <th>Latency</th>
                <th>Cost/1k</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {EVAL_RUNS.map((r, i) => (
                <tr key={r.version} className={i === 0 ? 'row-best' : ''}>
                  <td className="mono">{r.version}{i === 0 && <span className="pill">latest</span>}</td>
                  <td><Bar value={r.accuracy} /></td>
                  <td><Bar value={r.toolSuccess} /></td>
                  <td><Bar value={r.hallucination} invert /></td>
                  <td className="mono">{r.latencyMs}ms</td>
                  <td className="mono">${r.costUsd.toFixed(2)}</td>
                  <td className="dim">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Screen>
  )
}
