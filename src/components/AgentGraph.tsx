// A visual, read-through view of the agent draft as a graph: the agent at the centre,
// wired to its model, capabilities, MCP servers and memory layers. It rebuilds from the
// same draft the form edits, so switching to "Graph" shows exactly what you've authored.

import { useMemo } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { AgentDraft } from '../types/draft'

const COLORS = {
  agent: { bg: '#eef3ff', border: '#2f6fed' },
  model: { bg: '#fff7e6', border: '#d99a1c' },
  capability: { bg: '#eafbf0', border: '#2fa960' },
  mcp: { bg: '#eef6ff', border: '#3a86c8' },
  memory: { bg: '#f4eefb', border: '#8b5cd6' },
}

function nodeStyle(kind: keyof typeof COLORS): React.CSSProperties {
  const c = COLORS[kind]
  return {
    background: c.bg,
    border: `1px solid ${c.border}`,
    borderRadius: 8,
    fontSize: 12,
    padding: '8px 12px',
    color: '#1a2233',
    width: 180,
  }
}

function buildGraph(draft: AgentDraft): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const agentId = 'agent'
  nodes.push({
    id: agentId,
    position: { x: 40, y: 240 },
    data: { label: `🤖 ${draft.metadata.name || 'agent'}\nv${draft.metadata.version || '0.0.0'}` },
    style: { ...nodeStyle('agent'), width: 200, fontWeight: 600, whiteSpace: 'pre-line' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  })

  const column = (x: number, count: number, startY = 20, gap: number = 64) => {
    const height = count * gap
    const offset = 240 + 40 - height / 2 // roughly centre the column on the agent
    return (i: number) => ({ x, y: Math.max(startY, offset) + i * gap })
  }

  // Model
  if (draft.model.primary) {
    nodes.push({
      id: 'model',
      position: { x: 320, y: 20 },
      data: { label: `model: ${draft.model.primary}` },
      style: nodeStyle('model'),
      targetPosition: Position.Left,
    })
    edges.push({ id: 'e-model', source: agentId, target: 'model', animated: true })
  }

  // Capabilities
  const capAt = column(320, draft.capabilities.length, 100)
  draft.capabilities.forEach((c, i) => {
    const id = `cap-${i}`
    nodes.push({
      id,
      position: capAt(i),
      data: { label: `⚡ ${c.name || 'capability'}` },
      style: nodeStyle('capability'),
      targetPosition: Position.Left,
    })
    edges.push({ id: `e-${id}`, source: agentId, target: id })
  })

  // MCP servers
  const mcpAt = column(580, draft.mcpServers.length)
  draft.mcpServers.forEach((s, i) => {
    const id = `mcp-${i}`
    nodes.push({
      id,
      position: mcpAt(i),
      data: { label: `🔌 ${s.name || 'server'} (${s.transport})` },
      style: { ...nodeStyle('mcp'), opacity: s.enabled ? 1 : 0.5 },
      targetPosition: Position.Left,
    })
    edges.push({ id: `e-${id}`, source: agentId, target: id })
  })

  // Memory layers
  const memAt = column(840, draft.memoryLayers.length)
  draft.memoryLayers.forEach((m, i) => {
    const id = `mem-${i}`
    nodes.push({
      id,
      position: memAt(i),
      data: { label: `🧠 ${m}` },
      style: nodeStyle('memory'),
      targetPosition: Position.Left,
    })
    edges.push({ id: `e-${id}`, source: agentId, target: id })
  })

  return { nodes, edges }
}

export function AgentGraph({ draft }: { draft: AgentDraft }) {
  const { nodes, edges } = useMemo(() => buildGraph(draft), [draft])

  return (
    <div className="agent-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background color="#e6e9f0" gap={18} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
