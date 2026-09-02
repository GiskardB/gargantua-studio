// Draft validation, mirroring the invariants the Runtime enforces in the record
// constructors so the Studio catches a bad manifest before it ever reaches
// `gargantua validate`. Each rule cites the Java type it mirrors.
//
//   WorkloadMetadata : name + version required
//   AgentSpec        : capability names unique, MCP server names unique
//   Capability       : name/description/version required (Studio rule — the
//                      manifest schema marks all three required)
//   McpServerSpec    : name + transport required; stdio needs command;
//                      http/sse need url
//   ModelSpec        : temperature in [0,2], maxTokens > 0
//
// A GuardrailDraft with unparseable JSON is flagged here (buildManifest drops it
// silently so the preview still renders the valid parts).

import type { AgentDraft } from '../types/draft'
import { parseOptionalNumber } from './parse'

export type Severity = 'error' | 'warning'

export interface Issue {
  severity: Severity
  path: string
  message: string
}

export function validateDraft(d: AgentDraft): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) =>
    issues.push({ severity: 'error', path, message })
  const warn = (path: string, message: string) =>
    issues.push({ severity: 'warning', path, message })

  // --- metadata (WorkloadMetadata) ---
  if (!d.metadata.name.trim()) err('metadata.name', 'Name is required.')
  if (!d.metadata.version.trim()) err('metadata.version', 'Version is required.')

  // --- capabilities (Capability + AgentSpec uniqueness) ---
  const capNames = new Map<string, number>()
  d.capabilities.forEach((c, i) => {
    const label = `capabilities[${i}]`
    if (!c.name.trim()) err(`${label}.name`, 'Capability name is required.')
    if (!c.description.trim())
      err(`${label}.description`, 'Capability description is required.')
    if (!c.version.trim()) err(`${label}.version`, 'Capability version is required.')
    const key = c.name.trim()
    if (key) capNames.set(key, (capNames.get(key) ?? 0) + 1)
  })
  for (const [name, count] of capNames) {
    if (count > 1) err('capabilities', `Duplicate capability name "${name}".`)
  }

  // --- model (ModelSpec) ---
  const temp = parseOptionalNumber(d.model.temperature)
  if (d.model.temperature.trim() !== '' && temp === undefined)
    err('model.temperature', 'Temperature must be a number.')
  if (temp !== undefined && (temp < 0 || temp > 2))
    err('model.temperature', 'Temperature must be between 0.0 and 2.0.')
  const maxTokens = parseOptionalNumber(d.model.maxTokens)
  if (d.model.maxTokens.trim() !== '' && maxTokens === undefined)
    err('model.maxTokens', 'Max tokens must be a number.')
  if (maxTokens !== undefined && maxTokens <= 0)
    err('model.maxTokens', 'Max tokens must be positive.')

  // --- MCP servers (McpServerSpec + AgentSpec uniqueness) ---
  const serverNames = new Map<string, number>()
  d.mcpServers.forEach((s, i) => {
    const label = `mcp.servers[${i}]`
    if (!s.name.trim()) err(`${label}.name`, 'MCP server name is required.')
    if (s.transport === 'stdio') {
      if (!s.command.trim())
        err(`${label}.command`, 'stdio transport requires a command.')
    } else {
      if (!s.url.trim())
        err(`${label}.url`, `${s.transport} transport requires a url.`)
    }
    if (s.authType !== 'none' && !s.authValue.trim())
      warn(`${label}.auth`, `Auth type "${s.authType}" usually needs a value.`)
    if (s.authType === 'header' && !s.authHeaderName.trim())
      warn(`${label}.auth`, 'Header auth usually needs a header name.')
    if (s.transport !== 'stdio' && s.authType === 'none')
      warn(`${label}.auth`, `${s.transport} server has no authentication — it will call an external endpoint with no credentials.`)
    const key = s.name.trim()
    if (key) serverNames.set(key, (serverNames.get(key) ?? 0) + 1)
  })
  for (const [name, count] of serverNames) {
    if (count > 1) err('mcp.servers', `Duplicate MCP server name "${name}".`)
  }

  // --- guardrails (untyped map; Studio checks the JSON parses) ---
  d.guardrails.forEach((g, i) => {
    const label = `guardrails[${i}]`
    if (!g.name.trim()) {
      err(`${label}.name`, 'Guardrail name is required.')
      return
    }
    try {
      const parsed = JSON.parse(g.settingsJson)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        err(`${label}.settings`, 'Guardrail settings must be a JSON object.')
    } catch {
      err(`${label}.settings`, 'Guardrail settings must be valid JSON.')
    }
  })

  // --- PACT Core: cognition (Cognition), contract (Contract + Autonomy),
  // interfaces (InterfaceEndpoint) — declarative, but still structurally validated
  // the same way the Runtime rejects a malformed manifest.
  const contextWindow = parseOptionalNumber(d.cognition.contextWindowMinimum)
  if (d.cognition.contextWindowMinimum.trim() !== '' && contextWindow === undefined)
    err('cognition.requirements.contextWindow.minimum', 'Context window minimum must be a number.')
  if (contextWindow !== undefined && contextWindow <= 0)
    err('cognition.requirements.contextWindow.minimum', 'Context window minimum must be positive.')

  if (d.contract.autonomyLevel.trim() !== '') {
    const level = parseOptionalNumber(d.contract.autonomyLevel)
    if (level === undefined || level < 0 || level > 4 || !Number.isInteger(level))
      err('contract.autonomy.level', 'Autonomy level must be an integer between 0 and 4.')
  }

  d.interfaces.forEach((i, idx) => {
    const label = `interfaces[${idx}]`
    if (!i.protocol.trim()) err(`${label}.protocol`, 'Interface protocol is required.')
    if (!i.endpoint.trim()) err(`${label}.endpoint`, 'Interface endpoint is required.')
  })

  return issues
}

export function errorCount(issues: Issue[]): number {
  return issues.filter((i) => i.severity === 'error').length
}
