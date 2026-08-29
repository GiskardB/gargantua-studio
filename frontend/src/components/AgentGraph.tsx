// A visual, interactive view of the agent draft as a graph: the agent at the centre,
// wired to its model, capabilities, MCP servers and memory layers. Nodes are draggable,
// and clicking a node opens a detail panel for quick editing. Switching to "Graph"
// shows exactly what the form has authored; changes in the graph sync back to the
// draft immediately.

import { useMemo, useState, useCallback } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { AgentDraft, McpServerDraft, KnowledgeRefDraft } from '../types/draft'
import { applySkillToCapability } from '../types/draft'
import { MEMORY_LAYERS, type MemoryLayer } from '../types/manifest'
import { Field, TextInput, TextArea, Select, Checkbox } from './fields'
import { useSkillsStore } from '../store/skillsStore'

// ── colours ─────────────────────────────────────────────────────────────────

const COLORS = {
  agent:     { bg: '#eef3ff', border: '#2f6fed' },
  model:     { bg: '#fff7e6', border: '#d99a1c' },
  capability:{ bg: '#eafbf0', border: '#2fa960' },
  mcp:       { bg: '#eef6ff', border: '#3a86c8' },
  memory:    { bg: '#f4eefb', border: '#8b5cd6' },
  knowledge: { bg: '#fdeef4', border: '#c8437f' },
}

const KIND_LABELS: Record<string, string> = {
  agent: 'Agent',
  model: 'Model',
  capability: 'Capability',
  mcp: 'MCP Server',
  memory: 'Memory',
  knowledge: 'Knowledge',
}

// ── graph builder ────────────────────────────────────────────────────────────

interface NodeData extends Record<string, unknown> {
  label: string
  kind: string
  idx?: number
  version?: string
  transport?: string
  enabled?: boolean
}

function buildGraph(draft: AgentDraft): Node<NodeData>[] {
  const nodes: Node<NodeData>[] = []
  const c = (x: number, total: number, startY = 0, gap = 70) => {
    const height = total * gap
    const offset = 280 + 40 - height / 2
    return (i: number) => ({ x, y: Math.max(startY, offset) + i * gap })
  }

  nodes.push({
    id: 'agent',
    position: { x: 40, y: 280 },
    data: { label: draft.metadata.name || 'agent', version: draft.metadata.version || '0.0.0', kind: 'agent' },
    style: {
      background: COLORS.agent.bg,
      border: `2px solid ${COLORS.agent.border}`,
      borderRadius: 12,
      fontSize: 13,
      padding: '12px 16px',
      color: '#1a2233',
      fontWeight: 600,
      width: 210,
      cursor: 'default',
    },
    type: 'default',
    draggable: true,
  })

  const col1 = c(340, Math.max(draft.capabilities.length, draft.mcpServers.length, 1), 60)

  if (draft.model.primary) {
    nodes.push({
      id: 'model',
      position: { x: 340, y: 20 },
      data: { label: draft.model.primary, kind: 'model' },
      style: { background: COLORS.model.bg, border: `1px solid ${COLORS.model.border}`, borderRadius: 8, fontSize: 12, padding: '8px 12px', color: '#5a3800', width: 190 },
      type: 'default',
      draggable: true,
    })
  }

  draft.capabilities.forEach((cap, i) => {
    nodes.push({
      id: `cap-${i}`,
      position: col1(i),
      data: { label: cap.name || `cap-${i + 1}`, kind: 'capability', idx: i },
      style: { background: COLORS.capability.bg, border: `1px solid ${COLORS.capability.border}`, borderRadius: 8, fontSize: 12, padding: '8px 12px', color: '#0f3320', width: 200 },
      type: 'default',
      draggable: true,
    })
  })

  draft.mcpServers.forEach((srv, i) => {
    nodes.push({
      id: `mcp-${i}`,
      position: col1(draft.capabilities.length + i),
      data: { label: srv.name || `mcp-${i + 1}`, transport: srv.transport, enabled: srv.enabled, kind: 'mcp', idx: i },
      style: { background: COLORS.mcp.bg, border: `1px solid ${COLORS.mcp.border}`, borderRadius: 8, fontSize: 12, padding: '8px 12px', color: '#0f2a44', width: 200, opacity: srv.enabled ? 1 : 0.55 },
      type: 'default',
      draggable: true,
    })
  })

  const memCount = draft.memoryLayers.length || 1
  const memGap = 60
  const memHeight = memCount * memGap
  const memOffset = 280 + 40 - memHeight / 2
  draft.memoryLayers.forEach((m, i) => {
    nodes.push({
      id: `mem-${i}`,
      position: { x: 640, y: Math.max(60, memOffset) + i * memGap },
      data: { label: m, kind: 'memory', idx: i },
      style: { background: COLORS.memory.bg, border: `1px solid ${COLORS.memory.border}`, borderRadius: 8, fontSize: 12, padding: '8px 12px', color: '#3b1a6b', width: 160 },
      type: 'default',
      draggable: true,
    })
  })

  const kbCount = draft.loadout.knowledge.length || 1
  const kbGap = 60
  const kbHeight = kbCount * kbGap
  const kbOffset = 280 + 40 - kbHeight / 2
  draft.loadout.knowledge.forEach((k, i) => {
    nodes.push({
      id: `kb-${i}`,
      position: { x: 870, y: Math.max(60, kbOffset) + i * kbGap },
      data: { label: k.name || `kb-${i + 1}`, kind: 'knowledge', idx: i },
      style: { background: COLORS.knowledge.bg, border: `1px solid ${COLORS.knowledge.border}`, borderRadius: 8, fontSize: 12, padding: '8px 12px', color: '#5a1030', width: 180 },
      type: 'default',
      draggable: true,
    })
  })

  return nodes
}

// ── detail panel ─────────────────────────────────────────────────────────────

function GraphDetailPanel({
  node, draft, onChange, onClose, editingExisting,
}: {
  node: Node<NodeData>
  draft: AgentDraft
  onChange: (d: AgentDraft) => void
  onClose: () => void
  editingExisting?: boolean
}) {
  const { kind, idx } = node.data
  const savedSkills = useSkillsStore((s) => s.skills)

  const patch = (partial: Partial<AgentDraft>) => onChange({ ...draft, ...partial })

  // capabilities — every capability IS a skill; picking one derives the rest
  if (kind === 'capability' && idx !== undefined) {
    const cap = draft.capabilities[idx]
    const setSkill = (skillName: string) => {
      const skill = savedSkills.find((s) => s.draft.name === skillName)?.draft
      patch({
        capabilities: draft.capabilities.map((c, i) =>
          i === idx ? applySkillToCapability(skillName, skill) : c,
        ),
      })
    }
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">{KIND_LABELS[kind]}</span>
          <span className="graph-detail-name">{node.data.label}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <Field label="Skill" required hint="Everything below is derived from it">
            <select value={cap.implementedBy} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Select a skill…</option>
              {savedSkills.map((s) => s.draft.name && (
                <option key={s.id} value={s.draft.name}>{s.draft.name}</option>
              ))}
            </select>
          </Field>
          {cap.implementedBy ? (
            <div className="detail">
              <div className="detail-row"><span className="detail-k">Name</span><span className="mono">{cap.name || '—'}</span></div>
              <div className="detail-row"><span className="detail-k">Version</span><span className="mono">{cap.version || '—'}</span></div>
              <div className="detail-row"><span className="detail-k">Description</span><span>{cap.description || '—'}</span></div>
              <div className="detail-row"><span className="detail-k">Output schema</span><span className="mono">{cap.outputSchema || '—'}</span></div>
            </div>
          ) : (
            <p className="empty">Pick a skill to fill in this capability.</p>
          )}
        </div>
      </div>
    )
  }

  // MCP servers
  if (kind === 'mcp' && idx !== undefined) {
    const srv = draft.mcpServers[idx]
    const setSrv = (p: Partial<McpServerDraft>) =>
      patch({ mcpServers: draft.mcpServers.map((s, i) => i === idx ? { ...s, ...p } : s) })
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">{KIND_LABELS[kind]}</span>
          <span className="graph-detail-name">{node.data.label}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <Field label="Name"><TextInput value={srv.name} onChange={(v) => setSrv({ name: v })} mono /></Field>
          <Field label="Transport">
            <Select value={srv.transport} options={['http', 'stdio', 'sse', 'custom']} onChange={(v) => setSrv({ transport: v as typeof srv.transport })} />
          </Field>
          <Field label="URL"><TextInput value={srv.url} onChange={(v) => setSrv({ url: v })} mono /></Field>
          <Field label="Enabled"><Checkbox checked={srv.enabled} onChange={(v) => setSrv({ enabled: v })} label={srv.enabled ? 'enabled' : 'disabled'} /></Field>
          <Field label="Allowed tools"><TextInput value={srv.allowedTools} onChange={(v) => setSrv({ allowedTools: v })} mono /></Field>
        </div>
      </div>
    )
  }

  // memory layers
  if (kind === 'memory' && idx !== undefined) {
    const layer = draft.memoryLayers[idx] as MemoryLayer
    const setLayer = (layers: MemoryLayer[]) => patch({ memoryLayers: layers })
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">Memory Layer</span>
          <span className="graph-detail-name">{layer}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <p className="dim" style={{ fontSize: 12 }}>Toggle which layers to enable:</p>
          <div className="chips">
            {MEMORY_LAYERS.map(l => (
              <button key={l} className={draft.memoryLayers.includes(l) ? 'chip on' : 'chip'} onClick={() => {
                const has = draft.memoryLayers.includes(l)
                const next = has ? draft.memoryLayers.filter(x => x !== l) : [...draft.memoryLayers, l]
                setLayer(next as MemoryLayer[])
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // knowledge bases
  if (kind === 'knowledge' && idx !== undefined) {
    const kb = draft.loadout.knowledge[idx]
    const setKb = (p: Partial<KnowledgeRefDraft>) =>
      patch({ loadout: { ...draft.loadout, knowledge: draft.loadout.knowledge.map((k, i) => i === idx ? { ...k, ...p } : k) } })
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">Knowledge</span>
          <span className="graph-detail-name">{node.data.label}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <Field label="Name"><TextInput value={kb.name} onChange={(v) => setKb({ name: v })} mono /></Field>
          <Field label="Description"><TextArea value={kb.description} onChange={(v) => setKb({ description: v })} rows={2} /></Field>
          <Field label="Max results"><TextInput value={kb.maxResults} onChange={(v) => setKb({ maxResults: v })} mono /></Field>
          <Field label="Min score"><TextInput value={kb.minScore} onChange={(v) => setKb({ minScore: v })} mono /></Field>
        </div>
      </div>
    )
  }

  // model
  if (kind === 'model') {
    const patchModel = (p: Partial<AgentDraft['model']>) => patch({ model: { ...draft.model, ...p } })
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">Model</span>
          <span className="graph-detail-name">{node.data.label}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <Field label="Primary"><TextInput value={draft.model.primary} onChange={(v) => patchModel({ primary: v })} mono /></Field>
          <Field label="Fallback"><TextInput value={draft.model.fallback} onChange={(v) => patchModel({ fallback: v })} mono /></Field>
          <Field label="Temperature"><TextInput value={draft.model.temperature} onChange={(v) => patchModel({ temperature: v })} mono /></Field>
          <Field label="Max tokens"><TextInput value={draft.model.maxTokens} onChange={(v) => patchModel({ maxTokens: v })} mono /></Field>
        </div>
      </div>
    )
  }

  // agent root
  if (kind === 'agent') {
    const patchMeta = (p: Partial<AgentDraft['metadata']>) => patch({ metadata: { ...draft.metadata, ...p } })
    return (
      <div className="graph-detail">
        <div className="graph-detail-head">
          <span className="graph-detail-kind">Agent</span>
          <span className="graph-detail-name">{node.data.label}</span>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="graph-detail-body">
          <Field label="Name" hint={editingExisting ? 'Locked — you are updating an existing agent' : undefined}>
            <TextInput value={draft.metadata.name} onChange={(v) => patchMeta({ name: v })} mono disabled={editingExisting} />
          </Field>
          <Field label="Version"><TextInput value={draft.metadata.version} onChange={(v) => patchMeta({ version: v })} mono /></Field>
          <Field label="Description"><TextArea value={draft.metadata.description} onChange={(v) => patchMeta({ description: v })} rows={2} /></Field>
          <Field label="Owner"><TextInput value={draft.metadata.owner} onChange={(v) => patchMeta({ owner: v })} /></Field>
        </div>
      </div>
    )
  }

  return null
}

// ── main component ───────────────────────────────────────────────────────────

export function AgentGraph({
  draft, onDraftChange, editingExisting,
}: {
  draft: AgentDraft
  onDraftChange: (d: AgentDraft) => void
  editingExisting?: boolean
}) {
  const [nodes, setNodes] = useState<Node[]>(() => buildGraph(draft))
  const [selected, setSelected] = useState<Node<NodeData> | null>(null)

  // Keep positions while draft data changes; rebuild only if structure changes
  const savedPositions = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) m[n.id] = n.position
    return m
  }, [nodes])

  // Rebuild when draft structure changes (capabilities added/removed, etc.)
  const freshNodes = useMemo(() => {
    return buildGraph(draft).map(n => ({
      ...n,
      position: savedPositions[n.id] ?? n.position,
    }))
  }, [draft, savedPositions])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(ns =>
      ns.map(n => {
        const change = changes.find(c => c.type === 'position' && c.id === n.id) as
          | (NodeChange & { position: { x: number; y: number } })
          | undefined
        if (change?.position) {
          return { ...n, position: change.position }
        }
        return n
      })
    )
  }, [])

  const onNodeClick = useCallback((_evt: unknown, node: Node<NodeData>) => {
    setSelected(prev => prev?.id === node.id ? null : node)
  }, [])

  // Sync position updates back into the working node list
  const internalNodes = useMemo(() => {
    return freshNodes.map(n => {
      const pos = savedPositions[n.id]
      return pos ? { ...n, position: pos } : n
    })
  }, [freshNodes, savedPositions])

  return (
    <div className="agent-graph-wrap">
      <div className="agent-graph-hint">Click a node to edit · Drag to reposition</div>
      <div className="agent-graph">
        <ReactFlow
          nodes={internalNodes}
          edges={[]}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background color="#d8dde8" gap={20} />
          <MiniMap pannable zoomable nodeColor={n => {
            const k = (n.data as NodeData).kind as keyof typeof COLORS
            return COLORS[k]?.border ?? '#888'
          }} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {selected && (
        <div className="graph-detail-overlay">
          <GraphDetailPanel
            node={selected}
            draft={draft}
            onChange={onDraftChange}
            onClose={() => setSelected(null)}
            editingExisting={editingExisting}
          />
        </div>
      )}
    </div>
  )
}
