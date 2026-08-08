// TypeScript mirror of the gargantua.ai/v1 workload manifest.
//
// This is the contract with the Runtime, not a Studio-local invention. Every
// field here maps to a Java type in agent-core; keep them in lockstep:
//   AgentManifest   <- WorkloadManifest        (core.workload)
//   Metadata        <- WorkloadMetadata
//   AgentSpec       <- AgentSpec               (implements WorkloadSpec)
//   Capability      <- Capability              (core.capability)
//   ModelSpec       <- ModelSpec
//   McpServer       <- McpServerSpec           (core.mcp)
//   MemoryLayer     <- MemoryLayer             (core.memory)
// Reference: gargantua/docs/architecture/agent-manifest.md and
//            gargantua/docs/architecture/gargantua-domain-model.md

export const API_VERSION = 'gargantua.ai/v1' as const

export type MemoryLayer = 'WORKING' | 'EPISODIC' | 'KNOWLEDGE'
export const MEMORY_LAYERS: MemoryLayer[] = ['WORKING', 'EPISODIC', 'KNOWLEDGE']

export type McpTransport = 'stdio' | 'http' | 'sse'
export const MCP_TRANSPORTS: McpTransport[] = ['stdio', 'http', 'sse']

export type McpAuthType = 'none' | 'bearer' | 'basic' | 'header'
export const MCP_AUTH_TYPES: McpAuthType[] = ['none', 'bearer', 'basic', 'header']

export interface Metadata {
  name: string
  version: string
  description?: string
  owner?: string
  labels?: Record<string, string>
}

export interface Capability {
  name: string
  description: string
  version: string
  implementedBy?: string
  inputSchema?: string
  outputSchema?: string
  tags?: string[]
}

export interface ModelSpec {
  primary?: string
  fallback?: string
  routing?: string
  temperature?: number
  maxTokens?: number
}

export interface RuntimeSpec {
  image?: string
  minVersion?: string
}

export interface McpAuth {
  type: McpAuthType
  value?: string
  headerName?: string
}

export interface McpServer {
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  auth?: McpAuth
  allowedTools?: string[]
  enabled?: boolean
}

export interface KnowledgeRef {
  name: string
  description?: string
  maxResults?: number
  minScore?: number
}

export interface ResourceRef {
  name: string
  type?: string
  uri?: string
}

export interface Loadout {
  knowledge?: KnowledgeRef[]
  memoryScopes?: string[]
  skills?: string[]
  resources?: ResourceRef[]
}

export interface AgentSpec {
  runtime?: RuntimeSpec
  capabilities?: Capability[]
  model?: ModelSpec
  mcp?: { servers: McpServer[] }
  memoryLayers?: MemoryLayer[]
  defaultSkill?: string
  allowedRoles?: string[]
  guardrails?: Record<string, unknown>
  loadout?: Loadout
}

export interface AgentManifest {
  apiVersion: typeof API_VERSION
  kind: 'Agent'
  metadata: Metadata
  spec: AgentSpec
}
