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
  type Edge,
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
  agent:     { bg: '#eef3ff', border: '#2f6fed', text: '#1a2233' },
  model:     { bg: '#fff7e6', border: '#d99a1c', text: '#5a3800' },
  capability:{ bg: '#eafbf0', border: '#2fa960', text: '#0f3320' },
  mcp:       { bg: '#eef6ff', border: '#3a86c8', text: '#0f2a44' },
  memory:    { bg: '#f4eefb', border: '#8b5cd6', text: '#3b1a6b' },
  knowledge: { bg: '#fdeef4', border: '#c8437f', text: '#5a1030' },
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

interface Satellite {
  id: string
  kind: keyof typeof COLORS
  label: string
  idx?: number
  width: number
  dim?: boolean
  extra?: Partial<NodeData>
}

// Every satellite sits on a circle around the agent, connected to it by a straight spoke —
// a real hub-and-spoke graph instead of loose columns of boxes. This also keeps the whole
// thing compact regardless of screen size: `fitView` only ever has to fit one bounded
// circle, not five sprawling columns, which is what made the old layout unreadable on a
// phone (tiny zoomed-out text, lots of panning, and no edges to show what connects to what).
function buildGraph(draft: AgentDraft): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = []
  const edges: Edge[] = []

  nodes.push({
    id: 'agent',
    position: { x: 0, y: 0 },
    data: { label: draft.metadata.name || 'agent', version: draft.metadata.version || '0.0.0', kind: 'agent' },
    style: {
      background: COLORS.agent.bg,
      border: `2px solid ${COLORS.agent.border}`,
      borderRadius: 12,
      fontSize: 13,
      padding: '12px 16px',
      color: COLORS.agent.text,
      fontWeight: 600,
      width: 200,
      textAlign: 'center',
      cursor: 'default',
    },
    type: 'default',
    draggable: true,
  })

  const satellites: Satellite[] = []
  if (draft.model.primary) {
    satellites.push({ id: 'model', kind: 'model', label: draft.model.primary, width: 170 })
  }
  draft.capabilities.forEach((cap, i) =>
    satellites.push({ id: `cap-${i}`, kind: 'capability', label: cap.name || `cap-${i + 1}`, idx: i, width: 180 }))
  draft.mcpServers.forEach((srv, i) =>
    satellites.push({
      id: `mcp-${i}`, kind: 'mcp', label: srv.name || `mcp-${i + 1}`, idx: i, width: 180,
      dim: !srv.enabled, extra: { transport: srv.transport, enabled: srv.enabled },
    }))
  draft.memoryLayers.forEach((m, i) =>
    satellites.push({ id: `mem-${i}`, kind: 'memory', label: m, idx: i, width: 140 }))
  draft.loadout.knowledge.forEach((k, i) =>
    satellites.push({ id: `kb-${i}`, kind: 'knowledge', label: k.name || `kb-${i + 1}`, idx: i, width: 160 }))

  const total = satellites.length
  const radius = total <= 1 ? 220 : Math.max(240, total * 26)
  satellites.forEach((s, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2
    const c = COLORS[s.kind]
    nodes.push({
      id: s.id,
      position: { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) },
      data: { label: s.label, kind: s.kind, idx: s.idx, ...s.extra },
      style: {
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12,
        padding: '8px 12px', color: c.text, width: s.width, textAlign: 'center',
        opacity: s.dim ? 0.55 : 1,
      },
      type: 'default',
      draggable: true,
    })
    edges.push({
      id: `e-agent-${s.id}`,
      source: 'agent',
      target: s.id,
      type: 'straight',
      style: { stroke: c.border, strokeWidth: 1.5 },
    })
  })

  return { nodes, edges }
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
  const [nodes, setNodes] = useState<Node[]>(() => buildGraph(draft).nodes)
  const [selected, setSelected] = useState<Node<NodeData> | null>(null)

  // Keep positions while draft data changes; rebuild only if structure changes
  const savedPositions = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) m[n.id] = n.position
    return m
  }, [nodes])

  // Edges have no position of their own — they just follow whichever node they're
  // attached to — so they don't need the same position-preservation dance as nodes.
  const built = useMemo(() => buildGraph(draft), [draft])

  // Rebuild when draft structure changes (capabilities added/removed, etc.)
  const freshNodes = useMemo(() => {
    return built.nodes.map(n => ({
      ...n,
      position: savedPositions[n.id] ?? n.position,
    }))
  }, [built.nodes, savedPositions])

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
          edges={built.edges}
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
