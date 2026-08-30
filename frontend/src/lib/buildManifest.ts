// Draft → gargantua.ai/v1 manifest.
//
// The guiding rule is that a field the user left empty must not appear in the
// output: the Runtime treats an absent field as "inherit the default", and a
// manifest cluttered with empty strings and nulls reads as if choices were made
// that weren't. So every section is built up conditionally and omitted whole
// when it carries nothing.

import {
  API_VERSION,
  type AgentManifest,
  type AgentSpec,
  type Capability,
  type McpAuth,
  type McpServer,
  type Metadata,
  type ModelSpec,
  type RuntimeSpec,
  type Loadout,
  type KnowledgeRef,
  type ResourceRef,
  type Governance,
  type Cognition,
  type Contract,
  type InterfaceEndpoint,
  type ModelDescriptor,
} from '../types/manifest'
import type { AgentDraft } from '../types/draft'
import { parseArgs, parseCsv, parseKeyValueLines, parseOptionalNumber } from './parse'

function nonEmpty(s: string): string | undefined {
  const t = s.trim()
  return t === '' ? undefined : t
}

function buildGovernance(d: AgentDraft): Governance | undefined {
  const g = d.governance
  const gov: Governance = {}
  const tenant = nonEmpty(g.tenant)
  if (tenant) gov.tenant = tenant
  // Only emit visibility when it departs from the private default.
  if (g.visibility && g.visibility !== 'private') gov.visibility = g.visibility
  const status = nonEmpty(g.status)
  if (status) gov.status = status
  const access = parseCsv(g.accessText)
  if (access.length > 0) gov.access = access
  return Object.keys(gov).length > 0 ? gov : undefined
}

function buildMetadata(d: AgentDraft): Metadata {
  const labels = parseKeyValueLines(d.metadata.labelsText)
  const meta: Metadata = {
    name: d.metadata.name.trim(),
    version: d.metadata.version.trim(),
  }
  const description = nonEmpty(d.metadata.description)
  if (description) meta.description = description
  const owner = nonEmpty(d.metadata.owner)
  if (owner) meta.owner = owner
  if (Object.keys(labels).length > 0) meta.labels = labels
  const governance = buildGovernance(d)
  if (governance) meta.governance = governance
  return meta
}

function buildRuntime(d: AgentDraft): RuntimeSpec | undefined {
  const image = nonEmpty(d.runtime.image)
  const minVersion = nonEmpty(d.runtime.minVersion)
  if (!image && !minVersion) return undefined
  const rt: RuntimeSpec = {}
  if (image) rt.image = image
  if (minVersion) rt.minVersion = minVersion
  return rt
}

function buildModel(d: AgentDraft): ModelSpec | undefined {
  const primary = nonEmpty(d.model.primary)
  const fallback = nonEmpty(d.model.fallback)
  const routing = nonEmpty(d.model.routing)
  const temperature = parseOptionalNumber(d.model.temperature)
  const maxTokens = parseOptionalNumber(d.model.maxTokens)
  if (
    !primary &&
    !fallback &&
    !routing &&
    temperature === undefined &&
    maxTokens === undefined
  ) {
    return undefined
  }
  const model: ModelSpec = {}
  if (primary) model.primary = primary
  if (fallback) model.fallback = fallback
  if (routing) model.routing = routing
  if (temperature !== undefined) model.temperature = temperature
  if (maxTokens !== undefined) model.maxTokens = maxTokens
  return model
}

function buildCapabilities(d: AgentDraft): Capability[] {
  return d.capabilities.map((c) => {
    const cap: Capability = {
      name: c.name.trim(),
      description: c.description.trim(),
      version: c.version.trim(),
    }
    const implementedBy = nonEmpty(c.implementedBy)
    if (implementedBy) cap.implementedBy = implementedBy
    const inputSchema = nonEmpty(c.inputSchema)
    if (inputSchema) cap.inputSchema = inputSchema
    const outputSchema = nonEmpty(c.outputSchema)
    if (outputSchema) cap.outputSchema = outputSchema
    const tags = parseCsv(c.tags)
    if (tags.length > 0) cap.tags = tags
    return cap
  })
}

function buildMcpServers(d: AgentDraft): McpServer[] {
  return d.mcpServers.map((s) => {
    const server: McpServer = {
      name: s.name.trim(),
      transport: s.transport,
    }
    if (s.transport === 'stdio') {
      const command = nonEmpty(s.command)
      if (command) server.command = command
      const args = parseArgs(s.args)
      if (args.length > 0) server.args = args
      const env = parseKeyValueLines(s.envText)
      if (Object.keys(env).length > 0) server.env = env
    } else {
      const url = nonEmpty(s.url)
      if (url) server.url = url
    }
    if (s.authType !== 'none') {
      const auth: McpAuth = { type: s.authType }
      const value = nonEmpty(s.authValue)
      if (value) auth.value = value
      const headerName = nonEmpty(s.authHeaderName)
      if (headerName) auth.headerName = headerName
      server.auth = auth
    }
    const allowedTools = parseCsv(s.allowedTools)
    if (allowedTools.length > 0) server.allowedTools = allowedTools
    // enabled defaults to true; only emit when the operator turned it off.
    if (!s.enabled) server.enabled = false
    return server
  })
}

function buildGuardrails(d: AgentDraft): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const g of d.guardrails) {
    const name = nonEmpty(g.name)
    if (!name) continue
    try {
      out[name] = JSON.parse(g.settingsJson)
    } catch {
      // validate() surfaces the JSON error to the user; skip here so a bad
      // draft still produces a previewable manifest for the valid parts.
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function buildLoadout(d: AgentDraft): Loadout | undefined {
  const knowledge: KnowledgeRef[] = d.loadout.knowledge
    .filter((k) => nonEmpty(k.name))
    .map((k) => {
      const ref: KnowledgeRef = { name: k.name.trim() }
      const description = nonEmpty(k.description)
      if (description) ref.description = description
      const maxResults = parseOptionalNumber(k.maxResults)
      if (maxResults !== undefined) ref.maxResults = maxResults
      const minScore = parseOptionalNumber(k.minScore)
      if (minScore !== undefined) ref.minScore = minScore
      return ref
    })
  const memoryScopes = parseCsv(d.loadout.memoryScopesText)
  const skills = parseCsv(d.loadout.skillsText)
  const resources: ResourceRef[] = d.loadout.resources
    .filter((r) => nonEmpty(r.name))
    .map((r) => {
      const ref: ResourceRef = { name: r.name.trim() }
      const type = nonEmpty(r.type)
      if (type) ref.type = type
      const uri = nonEmpty(r.uri)
      if (uri) ref.uri = uri
      return ref
    })

  const loadout: Loadout = {}
  if (knowledge.length > 0) loadout.knowledge = knowledge
  if (memoryScopes.length > 0) loadout.memoryScopes = memoryScopes
  if (skills.length > 0) loadout.skills = skills
  if (resources.length > 0) loadout.resources = resources
  return Object.keys(loadout).length > 0 ? loadout : undefined
}

function buildModelDescriptor(m: { provider: string; family: string; name: string }): ModelDescriptor | undefined {
  const descriptor: ModelDescriptor = {}
  const provider = nonEmpty(m.provider)
  if (provider) descriptor.provider = provider
  const family = nonEmpty(m.family)
  if (family) descriptor.family = family
  const name = nonEmpty(m.name)
  if (name) descriptor.name = name
  return Object.keys(descriptor).length > 0 ? descriptor : undefined
}

function buildCognition(d: AgentDraft): Cognition | undefined {
  const c = d.cognition
  const cognition: Cognition = {}
  const modalities = parseCsv(c.modalitiesText)
  if (modalities.length > 0) cognition.modalities = modalities
  const capabilities = parseCsv(c.capabilitiesText)
  if (capabilities.length > 0) cognition.capabilities = capabilities

  const primary = buildModelDescriptor(c.primaryModel)
  const fallback = buildModelDescriptor(c.fallbackModel)
  if (primary || fallback) {
    cognition.models = {}
    if (primary) cognition.models.primary = primary
    if (fallback) cognition.models.fallback = fallback
  }

  const requiredModalities = parseCsv(c.requiredModalitiesText)
  const requiredCapabilities = parseCsv(c.requiredCapabilitiesText)
  const contextWindowMinimum = parseOptionalNumber(c.contextWindowMinimum)
  if (requiredModalities.length > 0 || requiredCapabilities.length > 0 || contextWindowMinimum !== undefined) {
    cognition.requirements = {}
    if (requiredModalities.length > 0) cognition.requirements.modalities = { required: requiredModalities }
    if (requiredCapabilities.length > 0) cognition.requirements.capabilities = { required: requiredCapabilities }
    if (contextWindowMinimum !== undefined) cognition.requirements.contextWindow = { minimum: contextWindowMinimum }
  }

  return Object.keys(cognition).length > 0 ? cognition : undefined
}

function buildContract(d: AgentDraft): Contract | undefined {
  const c = d.contract
  const contract: Contract = {}
  const level = parseOptionalNumber(c.autonomyLevel)
  if (level !== undefined) contract.autonomy = { level }
  const permissions = parseCsv(c.permissionsText)
  if (permissions.length > 0) contract.permissions = permissions
  return Object.keys(contract).length > 0 ? contract : undefined
}

function buildInterfaces(d: AgentDraft): InterfaceEndpoint[] {
  return d.interfaces
    .filter((i) => nonEmpty(i.protocol) && nonEmpty(i.endpoint))
    .map((i) => {
      const endpoint: InterfaceEndpoint = { protocol: i.protocol.trim(), endpoint: i.endpoint.trim() }
      const version = nonEmpty(i.version)
      if (version) endpoint.version = version
      return endpoint
    })
}

export function buildManifest(d: AgentDraft): AgentManifest {
  const spec: AgentSpec = {}

  const runtime = buildRuntime(d)
  if (runtime) spec.runtime = runtime

  const capabilities = buildCapabilities(d)
  if (capabilities.length > 0) spec.capabilities = capabilities

  const model = buildModel(d)
  if (model) spec.model = model

  const servers = buildMcpServers(d)
  if (servers.length > 0) spec.mcp = { servers }

  if (d.memoryLayers.length > 0) spec.memoryLayers = [...d.memoryLayers]

  const defaultSkill = nonEmpty(d.defaultSkill)
  if (defaultSkill) spec.defaultSkill = defaultSkill

  const allowedRoles = parseCsv(d.allowedRolesText)
  if (allowedRoles.length > 0) spec.allowedRoles = allowedRoles

  const guardrails = buildGuardrails(d)
  if (guardrails) spec.guardrails = guardrails

  const loadout = buildLoadout(d)
  if (loadout) spec.loadout = loadout

  const cognition = buildCognition(d)
  if (cognition) spec.cognition = cognition

  const contract = buildContract(d)
  if (contract) spec.contract = contract

  const interfaces = buildInterfaces(d)
  if (interfaces.length > 0) spec.interfaces = interfaces

  return {
    apiVersion: API_VERSION,
    kind: 'Agent',
    metadata: buildMetadata(d),
    spec,
  }
}
