// The editable, form-friendly shape the Agent Designer works with.
//
// It differs from AgentManifest on purpose: numbers are kept as strings (so
// inputs can be empty mid-edit), lists that the user edits always exist, and a
// few fields are flattened text areas (labels, env, tags) that parse into the
// structured manifest only at build time. buildManifest() is the one-way door
// from this draft to the real gargantua.ai/v1 document.

import type { MemoryLayer, McpTransport, McpAuthType } from './manifest'

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
  }
}
