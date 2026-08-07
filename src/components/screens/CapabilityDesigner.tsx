import { useEffect, useState } from 'react'
import { CAPABILITIES, CAPABILITY_SCHEMA_SAMPLE, type CapabilityRow } from '../../mock/data'
import { Screen, Panel, Badge, Tag, Dot, healthTone } from '../ui'
import { CodeEditor } from '../CodeEditor'
import { usePlatformStore } from '../../store/platformStore'

export function CapabilityDesigner() {
  const live = usePlatformStore((s) => s.capabilities)
  const source = usePlatformStore((s) => s.source)
  const refresh = usePlatformStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Real Catalog entries when online; sample data otherwise.
  const capabilities: CapabilityRow[] = live && live.length > 0 ? live : CAPABILITIES
  const isLive = source === 'live' && (live?.length ?? 0) > 0

  const [selected, setSelected] = useState(capabilities[0]?.name ?? '')
  const cap = capabilities.find((c) => c.name === selected) ?? capabilities[0]

  return (
    <Screen
      title="Capability Designer"
      subtitle="The external contracts callers route on — not agent names. Published to the Catalog."
      actions={
        <>
          <Badge tone={isLive ? 'good' : 'neutral'}>{isLive ? 'live' : 'sample data'}</Badge>
          <button className="primary">+ New capability</button>
        </>
      }
    >
      <div className="split-2">
        <Panel title="Catalog">
          <table className="table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Ver.</th>
                <th>Implemented by</th>
                <th>Calls/day</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((c) => (
                <tr
                  key={c.name}
                  className={c.name === selected ? 'row-selected' : 'row-click'}
                  onClick={() => setSelected(c.name)}
                >
                  <td className="mono">{c.name}</td>
                  <td className="mono dim">{c.version}</td>
                  <td className="dim">
                    {c.implementedBy.length} agent{c.implementedBy.length === 1 ? '' : 's'}
                  </td>
                  <td className="mono">{c.callsPerDay ? c.callsPerDay.toLocaleString() : '—'}</td>
                  <td><Dot tone={healthTone(c.health)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {cap && (
          <Panel title={cap.name} actions={<Badge tone="info">v{cap.version}</Badge>}>
            <div className="detail">
              <p className="detail-desc">{cap.description || 'No description provided.'}</p>

              <div className="detail-row">
                <span className="detail-k">Health</span>
                <span><Dot tone={healthTone(cap.health)} /> {cap.health}</span>
              </div>
              <div className="detail-row">
                <span className="detail-k">Implemented by</span>
                <span className="mono">{cap.implementedBy.join(', ') || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-k">Tags</span>
                <span className="tags">
                  {cap.tags.length ? cap.tags.map((t) => <Tag key={t}>{t}</Tag>) : '—'}
                </span>
              </div>

              <div className="detail-schema">
                <div className="detail-k">Input schema {isLive && <span className="dim">(sample)</span>}</div>
                <div className="schema-editor">
                  <CodeEditor value={CAPABILITY_SCHEMA_SAMPLE} language="json" readOnly />
                </div>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </Screen>
  )
}
