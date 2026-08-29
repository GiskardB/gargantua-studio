// The editable, form-friendly shape the Agent Designer works with.
//
// It differs from AgentManifest on purpose: numbers are kept as strings (so
// inputs can be empty mid-edit), lists that the user edits always exist, and a
// few fields are flattened text areas (labels, env, tags) that parse into the
// structured manifest only at build time. buildManifest() is the one-way door
// from this draft to the real gargantua.ai/v1 document.

import type { MemoryLayer, McpTransport, McpAuthType } from './manifest'
import type { SkillDraft } from './skillDraft'

export interface CapabilityDraft {
  name: string
  description: string
  version: string
  implementedBy: string
  inputSchema: string
  outputSchema: string
  tags: string // comma-separated
}

export interface McpServerDraft {
  name: string
  transport: McpTransport
  command: string
  args: string // whitespace/space-separated, quotes respected loosely
  envText: string // KEY=VALUE per line
  url: string
  authType: McpAuthType
  authValue: string
  authHeaderName: string
  allowedTools: string // comma-separated
  enabled: boolean
}

export interface GuardrailDraft {
  name: string
  settingsJson: string // a JSON object, e.g. {"enabled": true}
}

// ---- loadout: the specific knowledge/memory/skills/resources the agent is equipped with

export interface KnowledgeRefDraft {
  name: string // the knowledge base (vector collection) name
  description: string
  maxResults: string // stringly; empty = inherit the skill/runtime default
  minScore: string // stringly; empty = inherit
}

export interface ResourceRefDraft {
  name: string
  type: string // e.g. file, dataset, http, s3
  uri: string
}

export interface LoadoutDraft {
  knowledge: KnowledgeRefDraft[]
  memoryScopesText: string // comma-separated named memory collections
  skillsText: string // comma-separated skill names
  resources: ResourceRefDraft[]
}

// ---- governance: cross-cutting ownership/visibility/lifecycle (Control-Plane concern)

export type Visibility = 'private' | 'internal' | 'public'

export interface GovernanceDraft {
  tenant: string
  visibility: Visibility | '' // '' = inherit the private default
  status: string // free-form lifecycle label, e.g. draft/active/deprecated
  accessText: string // comma-separated ACL (roles/principals)
}

export interface AgentDraft {
  metadata: {
    name: string
    version: string
    description: string
    owner: string
    labelsText: string // KEY=VALUE per line
  }
  runtime: {
    image: string
    minVersion: string
  }
  model: {
    primary: string
    fallback: string
    routing: string
    temperature: string
    maxTokens: string
  }
  capabilities: CapabilityDraft[]
  mcpServers: McpServerDraft[]
  memoryLayers: MemoryLayer[]
  defaultSkill: string
  allowedRolesText: string // comma-separated
  guardrails: GuardrailDraft[]
  loadout: LoadoutDraft
  governance: GovernanceDraft
}

export function emptyCapability(): CapabilityDraft {
  return {
    name: '',
    description: '',
    version: '',
    implementedBy: '',
    inputSchema: '',
    outputSchema: '',
    tags: '',
  }
}

// Every capability IS a skill: picking one derives the rest of the card. Only
// `implementedBy` is user-chosen; the fields a skill doesn't have (input schema,
// tags) are left blank since there's nothing to derive them from.
export function applySkillToCapability(skillName: string, skill: SkillDraft | undefined): CapabilityDraft {
  return {
    name: skill?.name ?? skillName,
    description: skill?.description ?? '',
    version: skill?.version ?? '',
    implementedBy: skillName,
    inputSchema: '',
    outputSchema: skill?.outputSchema ?? '',
    tags: '',
  }
}

function parseSemver(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v || '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0]
}

/** -1/0/1 like a standard comparator; unparseable versions sort as 0.0.0. */
export function compareVersions(a: string, b: string): number {
  const [a1, a2, a3] = parseSemver(a)
  const [b1, b2, b3] = parseSemver(b)
  return a1 - b1 || a2 - b2 || a3 - b3
}

/** Patch-bumps a version for republishing (versions are immutable on the Control Plane); '1.0.0' for a first save. */
export function nextVersion(current: string): string {
  if (!current) return '1.0.0'
  const [maj, min, pat] = parseSemver(current)
  return `${maj}.${min}.${pat + 1}`
}

export function emptyMcpServer(): McpServerDraft {
  return {
    name: '',
    transport: 'http',
    command: '',
    args: '',
    envText: '',
    url: '',
    authType: 'none',
    authValue: '',
    authHeaderName: '',
    allowedTools: '',
    enabled: true,
  }
}

export function emptyGuardrail(): GuardrailDraft {
  return { name: '', settingsJson: '{\n  "enabled": true\n}' }
}

export function emptyKnowledgeRef(): KnowledgeRefDraft {
  return { name: '', description: '', maxResults: '', minScore: '' }
}

export function emptyResourceRef(): ResourceRefDraft {
  return { name: '', type: '', uri: '' }
}

export function emptyLoadout(): LoadoutDraft {
  return { knowledge: [], memoryScopesText: '', skillsText: '', resources: [] }
}

export function emptyGovernance(): GovernanceDraft {
  return { tenant: '', visibility: '', status: '', accessText: '' }
}

export function emptyDraft(): AgentDraft {
  return {
    metadata: { name: '', version: '', description: '', owner: '', labelsText: '' },
    runtime: { image: '', minVersion: '' },
    model: { primary: '', fallback: '', routing: '', temperature: '', maxTokens: '' },
    capabilities: [],
    mcpServers: [],
    memoryLayers: [],
    defaultSkill: '',
    allowedRolesText: '',
    guardrails: [],
    loadout: emptyLoadout(),
    governance: emptyGovernance(),
  }
}

// A filled-in example mirroring docs/architecture/agent-manifest.md, so the
// designer opens with something a new user can read and reshape.
export function sampleDraft(): AgentDraft {
  return {
    metadata: {
      name: 'customer-agent',
      version: '1.2.0',
      description: 'Handles customer payment enquiries and refunds',
      owner: 'payments-team',
      labelsText: 'env=prod\ntier=critical',
    },
    runtime: { image: 'ghcr.io/giskardb/gargantua-runtime:1.0', minVersion: '1.0' },
    model: {
      primary: 'gpt-4o',
      fallback: 'claude-sonnet-4-20250514',
      routing: 'phi4-mini',
      temperature: '0.7',
      maxTokens: '1000',
    },
    capabilities: [
      {
        name: 'refund-payment',
        description: 'Handles a payment refund request',
        version: '1.0.0',
        implementedBy: 'refund-skill',
        inputSchema: 'schemas/refund-input.json',
        outputSchema: 'schemas/refund-output.json',
        tags: 'payments, gdpr',
      },
      {
        name: 'payment-status',
        description: 'Reports the current status of a payment',
        version: '1.1.0',
        implementedBy: '',
        inputSchema: '',
        outputSchema: '',
        tags: '',
      },
    ],
    mcpServers: [
      {
        name: 'payments-api',
        transport: 'http',
        command: '',
        args: '',
        envText: '',
        url: 'https://mcp.internal/payments',
        authType: 'bearer',
        authValue: '${secrets.payments-api-token}',
        authHeaderName: '',
        allowedTools: 'getPayment, refundPayment',
        enabled: true,
      },
      {
        name: 'github',
        transport: 'stdio',
        command: 'npx',
        args: '-y @modelcontextprotocol/server-github',
        envText: 'GITHUB_TOKEN=${secrets.github-token}',
        url: '',
        authType: 'none',
        authValue: '',
        authHeaderName: '',
        allowedTools: '',
        enabled: true,
      },
    ],
    memoryLayers: ['WORKING', 'EPISODIC'],
    defaultSkill: 'default-skill',
    allowedRolesText: 'support-agent, super-admin',
    guardrails: [
      { name: 'pii-input', settingsJson: '{\n  "enabled": true\n}' },
      { name: 'max-length', settingsJson: '{\n  "maxChars": 8000\n}' },
    ],
    loadout: {
      knowledge: [
        {
          name: 'payments-kb',
          description: 'Payment policies and refund rules',
          maxResults: '8',
          minScore: '0.55',
        },
        { name: 'refunds-kb', description: '', maxResults: '', minScore: '' },
      ],
      memoryScopesText: 'customer-history',
      skillsText: 'refund-skill, status-skill',
      resources: [{ name: 'refund-form', type: 'file', uri: 'resources/refund.pdf' }],
    },
    governance: {
      tenant: 'payments',
      visibility: 'internal',
      status: 'active',
      accessText: 'support-agent, super-admin',
    },
  }
}
