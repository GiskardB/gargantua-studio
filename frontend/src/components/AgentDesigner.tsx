// The Agent Designer: a structured form over AgentDraft. Every section maps to a
// block of the gargantua.ai/v1 spec. State lives one level up in App; this
// component only reads the draft and emits a new one, so the manifest preview
// stays in sync with no extra wiring.

import type {
  AgentDraft,
  CapabilityDraft,
  McpServerDraft,
  GuardrailDraft,
  LoadoutDraft,
  KnowledgeRefDraft,
  ResourceRefDraft,
  GovernanceDraft,
  Visibility,
  CognitionDraft,
  ContractDraft,
  ModelDescriptorDraft,
  InterfaceEndpointDraft,
} from '../types/draft'
import {
  emptyCapability,
  emptyMcpServer,
  emptyGuardrail,
  emptyKnowledgeRef,
  emptyResourceRef,
  emptyInterfaceEndpoint,
  applySkillToCapability,
} from '../types/draft'
import {
  MCP_TRANSPORTS,
  MCP_AUTH_TYPES,
  MEMORY_LAYERS,
  type MemoryLayer,
} from '../types/manifest'
import { Section, Field, TextInput, TextArea, Select, Checkbox } from './fields'
import { useSkillsStore } from '../store/skillsStore'

interface Props {
  draft: AgentDraft
  onChange: (next: AgentDraft) => void
  /** True while editing an already-published workload — its name is fixed. */
  editingExisting?: boolean
}

export function AgentDesigner({ draft, onChange, editingExisting }: Props) {
  // Skills the user has authored, so `implementedBy` can be picked rather than typed
  // blind — this is now the only place a skill gets linked to an agent.
  const savedSkills = useSkillsStore((s) => s.skills)

  // ---- top-level patch helpers ----
  const patch = (partial: Partial<AgentDraft>) => onChange({ ...draft, ...partial })
  const patchMeta = (partial: Partial<AgentDraft['metadata']>) =>
    patch({ metadata: { ...draft.metadata, ...partial } })
  const patchRuntime = (partial: Partial<AgentDraft['runtime']>) =>
    patch({ runtime: { ...draft.runtime, ...partial } })
  const patchModel = (partial: Partial<AgentDraft['model']>) =>
    patch({ model: { ...draft.model, ...partial } })

  // Heuristic: parse a model string like "gpt-4o" or "claude-sonnet-4-20250514"
  // into provider/family/name for the PACT Cognition section.
  const parseModelString = (s: string): { provider: string; family: string; name: string } => {
    const t = s.trim().toLowerCase()
    if (!t) return { provider: '', family: '', name: '' }
    if (t.includes('gpt')) return { provider: 'openai', family: 'gpt', name: s }
    if (t.includes('claude')) return { provider: 'anthropic', family: 'claude', name: s }
    if (t.includes('gemini')) return { provider: 'google', family: 'gemini', name: s }
    if (t.includes('phi')) return { provider: 'microsoft', family: 'phi', name: s }
    if (t.includes('llama')) return { provider: 'meta', family: 'llama', name: s }
    if (t.includes('mistral')) return { provider: 'mistral', family: 'mistral', name: s }
    if (t.includes('qwen')) return { provider: 'alibaba', family: 'qwen', name: s }
    if (t.includes('deepseek')) return { provider: 'deepseek', family: 'deepseek', name: s }
    return { provider: '', family: '', name: s }
  }

  const setPrimaryModel = (v: string) => {
    patchModel({ primary: v })
    const { provider, family, name } = parseModelString(v)
    patchCognition({ primaryModel: { provider, family, name } })
  }
  const setFallbackModel = (v: string) => {
    patchModel({ fallback: v })
    const { provider, family, name } = parseModelString(v)
    patchCognition({ fallbackModel: { provider, family, name } })
  }

  // ---- capabilities (the only place a skill is linked to this agent) ----
  const setCapability = (i: number, partial: Partial<CapabilityDraft>) =>
    patch({
      capabilities: draft.capabilities.map((c, idx) => (idx === i ? { ...c, ...partial } : c)),
    })
  const addCapability = () => patch({ capabilities: [...draft.capabilities, emptyCapability()] })
  const removeCapability = (i: number) =>
    patch({ capabilities: draft.capabilities.filter((_, idx) => idx !== i) })
  // A capability IS a skill: picking one derives every other field on the card.
  const setCapabilitySkill = (i: number, skillName: string) => {
    const skill = savedSkills.find((s) => s.draft.name === skillName)?.draft
    setCapability(i, applySkillToCapability(skillName, skill))
  }

  // ---- MCP servers ----
  const setServer = (i: number, partial: Partial<McpServerDraft>) =>
    patch({
      mcpServers: draft.mcpServers.map((s, idx) =>
        idx === i ? { ...s, ...partial } : s,
      ),
    })
  const addServer = () => patch({ mcpServers: [...draft.mcpServers, emptyMcpServer()] })
  const removeServer = (i: number) =>
    patch({ mcpServers: draft.mcpServers.filter((_, idx) => idx !== i) })

  // ---- guardrails ----
  const setGuardrail = (i: number, partial: Partial<GuardrailDraft>) =>
    patch({
      guardrails: draft.guardrails.map((g, idx) =>
        idx === i ? { ...g, ...partial } : g,
      ),
    })
  const addGuardrail = () => patch({ guardrails: [...draft.guardrails, emptyGuardrail()] })
  const removeGuardrail = (i: number) =>
    patch({ guardrails: draft.guardrails.filter((_, idx) => idx !== i) })

  // ---- loadout (knowledge bases, memory scopes, skills, resources) ----
  const patchLoadout = (partial: Partial<LoadoutDraft>) =>
    patch({ loadout: { ...draft.loadout, ...partial } })
  const setKnowledge = (i: number, partial: Partial<KnowledgeRefDraft>) =>
    patchLoadout({
      knowledge: draft.loadout.knowledge.map((k, idx) => (idx === i ? { ...k, ...partial } : k)),
    })
  const addKnowledge = () =>
    patchLoadout({ knowledge: [...draft.loadout.knowledge, emptyKnowledgeRef()] })
  const removeKnowledge = (i: number) =>
    patchLoadout({ knowledge: draft.loadout.knowledge.filter((_, idx) => idx !== i) })
  const setResource = (i: number, partial: Partial<ResourceRefDraft>) =>
    patchLoadout({
      resources: draft.loadout.resources.map((r, idx) => (idx === i ? { ...r, ...partial } : r)),
    })
  const addResource = () =>
    patchLoadout({ resources: [...draft.loadout.resources, emptyResourceRef()] })
  const removeResource = (i: number) =>
    patchLoadout({ resources: draft.loadout.resources.filter((_, idx) => idx !== i) })

  // ---- governance (tenant, visibility, status, ACL) ----
  const patchGovernance = (partial: Partial<GovernanceDraft>) =>
    patch({ governance: { ...draft.governance, ...partial } })

  // ---- PACT Core: cognition, contract, interfaces (declarative — see agent-manifest.md
  // "Relationship to PACT") ----
  const patchCognition = (partial: Partial<CognitionDraft>) =>
    patch({ cognition: { ...draft.cognition, ...partial } })
  const patchPrimaryModel = (partial: Partial<ModelDescriptorDraft>) =>
    patchCognition({ primaryModel: { ...draft.cognition.primaryModel, ...partial } })
  const patchFallbackModel = (partial: Partial<ModelDescriptorDraft>) =>
    patchCognition({ fallbackModel: { ...draft.cognition.fallbackModel, ...partial } })
  const patchContract = (partial: Partial<ContractDraft>) =>
    patch({ contract: { ...draft.contract, ...partial } })
  const setInterface = (i: number, partial: Partial<InterfaceEndpointDraft>) =>
    patch({
      interfaces: draft.interfaces.map((e, idx) => (idx === i ? { ...e, ...partial } : e)),
    })
  const addInterface = () => patch({ interfaces: [...draft.interfaces, emptyInterfaceEndpoint()] })
  const removeInterface = (i: number) =>
    patch({ interfaces: draft.interfaces.filter((_, idx) => idx !== i) })

  // ---- memory layers (toggle set) ----
  const toggleLayer = (layer: MemoryLayer) => {
    const has = draft.memoryLayers.includes(layer)
    patch({
      memoryLayers: has
        ? draft.memoryLayers.filter((l) => l !== layer)
        : [...draft.memoryLayers, layer],
    })
  }

  return (
    <div className="designer">
      <Section title="Metadata" hint="Identity of the workload — name and version are required.">
        <div className="grid two">
          <Field
            label="Name"
            required
            hint={editingExisting ? 'Locked — you are updating an existing agent' : 'Stable across versions, e.g. customer-agent'}
          >
            <TextInput value={draft.metadata.name} onChange={(v) => patchMeta({ name: v })} placeholder="customer-agent" mono disabled={editingExisting} />
          </Field>
          <Field label="Version" required hint="Semver of this revision — precompiled, bumped automatically on publish">
            <TextInput value={draft.metadata.version} onChange={(v) => patchMeta({ version: v })} placeholder="1.0.0" mono />
          </Field>
        </div>
        <Field label="Description" hint="Shown in Studio and the Catalog">
          <TextInput value={draft.metadata.description} onChange={(v) => patchMeta({ description: v })} placeholder="Handles customer payment enquiries" />
        </Field>
        <div className="grid two">
          <Field label="Owner" hint="Owning team, used for Catalog ownership">
            <TextInput value={draft.metadata.owner} onChange={(v) => patchMeta({ owner: v })} placeholder="payments-team" />
          </Field>
          <Field label="Labels" hint="KEY=VALUE per line">
            <TextArea value={draft.metadata.labelsText} onChange={(v) => patchMeta({ labelsText: v })} placeholder={'env=prod\ntier=critical'} rows={2} mono />
          </Field>
        </div>
      </Section>

      <Section
        title="Governance"
        hint="Cross-cutting ownership and visibility for the Catalog. Reported now; the Policy Manager enforces it later. (created/updated timestamps are assigned by the Control Plane.)"
      >
        <div className="grid three">
          <Field label="Tenant" hint="Owning tenant/organisation; blank = default">
            <TextInput value={draft.governance.tenant} onChange={(v) => patchGovernance({ tenant: v })} placeholder="payments" mono />
          </Field>
          <Field label="Visibility" hint="Blank = private (the safe default)">
            <Select
              value={draft.governance.visibility}
              options={['', 'private', 'internal', 'public'] as const}
              onChange={(v: Visibility | '') => patchGovernance({ visibility: v })}
            />
          </Field>
          <Field label="Status" hint="Free-form lifecycle label">
            <TextInput value={draft.governance.status} onChange={(v) => patchGovernance({ status: v })} placeholder="active" mono />
          </Field>
        </div>
        <Field label="Access (ACL)" hint="Who can discover/find this agent in the Catalog beyond what Visibility implies — not who can call it (see Allowed roles, under Routing & roles below)">
          <TextInput value={draft.governance.accessText} onChange={(v) => patchGovernance({ accessText: v })} placeholder="ops, support" />
        </Field>
      </Section>

      <Section title="Runtime" hint="Which image the bundle needs. Leave blank for the platform default.">
        <div className="grid two">
          <Field label="Image" hint="Name a custom image only for library-mode Java tools">
            <TextInput value={draft.runtime.image} onChange={(v) => patchRuntime({ image: v })} placeholder="ghcr.io/giskardb/gargantua-runtime:1.0" mono />
          </Field>
          <Field label="Min version" hint="Recorded for the Deployment Manager; not verified by the runtime">
            <TextInput value={draft.runtime.minVersion} onChange={(v) => patchRuntime({ minVersion: v })} placeholder="1.0" mono />
          </Field>
        </div>
      </Section>

      <Section title="Model" hint="Model names only — endpoints and keys come from the runtime environment. The Cognition section below is filled in automatically from these names (provider/family), so write it here first.">
        <div className="grid three">
          <Field label="Primary"><TextInput value={draft.model.primary} onChange={setPrimaryModel} placeholder="gpt-4o" mono /></Field>
          <Field label="Fallback"><TextInput value={draft.model.fallback} onChange={setFallbackModel} placeholder="claude-sonnet-4-20250514" mono /></Field>
          <Field label="Routing"><TextInput value={draft.model.routing} onChange={(v) => patchModel({ routing: v })} placeholder="phi4-mini" mono /></Field>
        </div>
        <div className="grid two">
          <Field label="Temperature" hint="0.0 – 2.0"><TextInput value={draft.model.temperature} onChange={(v) => patchModel({ temperature: v })} placeholder="0.7" mono /></Field>
          <Field label="Max tokens" hint="Positive integer"><TextInput value={draft.model.maxTokens} onChange={(v) => patchModel({ maxTokens: v })} placeholder="1000" mono /></Field>
        </div>
      </Section>

      <Section
        title="Capabilities"
        hint="The external contract callers route on. Every capability is a skill — pick one (write it in the Skill Designer first) and its name, version, description and output schema are derived from it. This is the only place a skill becomes an advertised, routable capability — Loadout > Skills below equips extra skills without exposing them externally."
      >
        {draft.capabilities.length === 0 && <p className="empty">No capabilities yet.</p>}
        {draft.capabilities.map((c, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Capability {i + 1}</strong>
              <button className="link danger" onClick={() => removeCapability(i)}>remove</button>
            </div>
            <Field label="Skill" required hint="Derives name, version, description and output schema. Input schema and tags below are not derived — fill them in yourself.">
              <select value={c.implementedBy} onChange={(e) => setCapabilitySkill(i, e.target.value)}>
                <option value="">Select a skill…</option>
                {savedSkills.map((s) => s.draft.name && (
                  <option key={s.id} value={s.draft.name}>{s.draft.name}</option>
                ))}
              </select>
            </Field>
            {c.implementedBy ? (
              <div className="detail">
                <div className="detail-row"><span className="detail-k">Name</span><span className="mono">{c.name || '—'}</span></div>
                <div className="detail-row"><span className="detail-k">Version</span><span className="mono">{c.version || '—'}</span></div>
                <div className="detail-row"><span className="detail-k">Description</span><span>{c.description || '—'}</span></div>
                <div className="detail-row"><span className="detail-k">Output schema</span><span className="mono">{c.outputSchema || '—'}</span></div>
              </div>
            ) : (
              <p className="empty">Pick a skill to fill in this capability.</p>
            )}
            <div className="grid two">
              <Field label="Input schema" hint="Bundle-relative path or inline schema; not derived from the skill">
                <TextInput value={c.inputSchema} onChange={(v) => setCapability(i, { inputSchema: v })} placeholder="schemas/refund-input.json" mono />
              </Field>
              <Field label="Tags" hint="Comma-separated, for Catalog search/filtering">
                <TextInput value={c.tags} onChange={(v) => setCapability(i, { tags: v })} placeholder="payments, gdpr" mono />
              </Field>
            </div>
          </div>
        ))}
        <button className="add" onClick={addCapability}>+ Add capability</button>
      </Section>

      <Section title="MCP servers" hint="In runtime mode this is where all tools come from.">
        {draft.mcpServers.length === 0 && <p className="empty">No MCP servers yet.</p>}
        {draft.mcpServers.map((s, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Server {i + 1}</strong>
              <button className="link danger" onClick={() => removeServer(i)}>remove</button>
            </div>
            <div className="grid three">
              <Field label="Name" required><TextInput value={s.name} onChange={(v) => setServer(i, { name: v })} placeholder="payments-api" mono /></Field>
              <Field label="Transport" required>
                <Select value={s.transport} options={MCP_TRANSPORTS} onChange={(v) => setServer(i, { transport: v })} />
              </Field>
              <Field label="Enabled">
                <Checkbox checked={s.enabled} onChange={(v) => setServer(i, { enabled: v })} label={s.enabled ? 'enabled' : 'disabled'} />
              </Field>
            </div>
            {s.transport === 'stdio' ? (
              <>
                <div className="grid two">
                  <Field label="Command" required><TextInput value={s.command} onChange={(v) => setServer(i, { command: v })} placeholder="npx" mono /></Field>
                  <Field label="Args" hint="Space-separated"><TextInput value={s.args} onChange={(v) => setServer(i, { args: v })} placeholder="-y @modelcontextprotocol/server-github" mono /></Field>
                </div>
                <Field label="Env" hint="KEY=VALUE per line; supports ${secrets.NAME}"><TextArea value={s.envText} onChange={(v) => setServer(i, { envText: v })} placeholder={'GITHUB_TOKEN=${secrets.github-token}'} rows={2} mono /></Field>
              </>
            ) : (
              <Field label="URL" required><TextInput value={s.url} onChange={(v) => setServer(i, { url: v })} placeholder="https://mcp.internal/payments" mono /></Field>
            )}
            <div className="grid three">
              <Field label="Auth type">
                <Select value={s.authType} options={MCP_AUTH_TYPES} onChange={(v) => setServer(i, { authType: v })} />
              </Field>
              {s.authType !== 'none' && (
                <Field label="Auth value" hint="Use ${secrets.NAME}"><TextInput value={s.authValue} onChange={(v) => setServer(i, { authValue: v })} placeholder="${secrets.payments-api-token}" mono /></Field>
              )}
              {s.authType === 'header' && (
                <Field label="Header name"><TextInput value={s.authHeaderName} onChange={(v) => setServer(i, { authHeaderName: v })} placeholder="X-Api-Key" mono /></Field>
              )}
            </div>
            <Field label="Allowed tools" hint="Comma-separated allow-list; empty exposes all"><TextInput value={s.allowedTools} onChange={(v) => setServer(i, { allowedTools: v })} placeholder="getPayment, refundPayment" mono /></Field>
          </div>
        ))}
        <button className="add" onClick={addServer}>+ Add MCP server</button>
      </Section>

      <Section title="Memory layers" hint="Leave all unchecked to enable all three. (Manifest-level selection is reported, not yet enforced.)">
        <div className="chips">
          {MEMORY_LAYERS.map((layer) => (
            <button
              key={layer}
              className={draft.memoryLayers.includes(layer) ? 'chip on' : 'chip'}
              onClick={() => toggleLayer(layer)}
            >
              {layer}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Loadout"
        hint="What this agent is equipped with — specific knowledge bases, memory scopes, skills and resources — rather than implicit access to everything. (Reported by the runtime; provisioning is not enforced yet.)"
      >
        <div className="sub">Knowledge bases</div>
        {draft.loadout.knowledge.length === 0 && (
          <p className="empty">No knowledge bases equipped.</p>
        )}
        {draft.loadout.knowledge.map((k, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Knowledge {i + 1}</strong>
              <button className="link danger" onClick={() => removeKnowledge(i)}>remove</button>
            </div>
            <div className="grid three">
              <Field label="Name" required hint="Vector collection / index name">
                <TextInput value={k.name} onChange={(v) => setKnowledge(i, { name: v })} placeholder="payments-kb" mono />
              </Field>
              <Field label="Max results" hint="Empty = skill default">
                <TextInput value={k.maxResults} onChange={(v) => setKnowledge(i, { maxResults: v })} placeholder="8" mono />
              </Field>
              <Field label="Min score" hint="0.0 – 1.0; empty = default">
                <TextInput value={k.minScore} onChange={(v) => setKnowledge(i, { minScore: v })} placeholder="0.55" mono />
              </Field>
            </div>
            <Field label="Description">
              <TextInput value={k.description} onChange={(v) => setKnowledge(i, { description: v })} placeholder="Payment policies and refund rules" />
            </Field>
          </div>
        ))}
        <button className="add" onClick={addKnowledge}>+ Add knowledge base</button>

        <div className="grid two">
          <Field label="Memory scopes" hint="Comma-separated named memory collections">
            <TextInput value={draft.loadout.memoryScopesText} onChange={(v) => patchLoadout({ memoryScopesText: v })} placeholder="customer-history" mono />
          </Field>
          <Field label="Skills" hint="Comma-separated skill names to equip beyond Default skill — free text, not checked against the Skill Designer; does not advertise a Capability (use the Capabilities section above for that)">
            <TextInput value={draft.loadout.skillsText} onChange={(v) => patchLoadout({ skillsText: v })} placeholder="refund-skill, status-skill" mono />
          </Field>
        </div>

        <div className="sub">Resources</div>
        {draft.loadout.resources.length === 0 && <p className="empty">No resources equipped.</p>}
        {draft.loadout.resources.map((r, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Resource {i + 1}</strong>
              <button className="link danger" onClick={() => removeResource(i)}>remove</button>
            </div>
            <div className="grid three">
              <Field label="Name" required><TextInput value={r.name} onChange={(v) => setResource(i, { name: v })} placeholder="refund-form" mono /></Field>
              <Field label="Type" hint="file, dataset, http, s3…"><TextInput value={r.type} onChange={(v) => setResource(i, { type: v })} placeholder="file" mono /></Field>
              <Field label="URI" hint="No secrets — reference by ${secrets.NAME}"><TextInput value={r.uri} onChange={(v) => setResource(i, { uri: v })} placeholder="resources/refund.pdf" mono /></Field>
            </div>
          </div>
        ))}
        <button className="add" onClick={addResource}>+ Add resource</button>
      </Section>

      <Section title="Routing & roles">
        <div className="grid two">
          <Field label="Default skill" hint="Entry skill; binds to agent.routing.fallback-skill"><TextInput value={draft.defaultSkill} onChange={(v) => patch({ defaultSkill: v })} placeholder="default-skill" mono /></Field>
          <Field label="Allowed roles" hint="Who can invoke this agent at runtime — not who can find it in the Catalog (see Access (ACL), under Governance above). Comma-separated; reported, not yet enforced at workload level"><TextInput value={draft.allowedRolesText} onChange={(v) => patch({ allowedRolesText: v })} placeholder="support-agent, super-admin" /></Field>
        </div>
      </Section>

      <Section title="Guardrails" hint="Raw overrides keyed by guardrail name; each value is a JSON object.">
        {draft.guardrails.length === 0 && <p className="empty">No guardrail overrides yet.</p>}
        {draft.guardrails.map((g, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Guardrail {i + 1}</strong>
              <button className="link danger" onClick={() => removeGuardrail(i)}>remove</button>
            </div>
            <div className="grid two">
              <Field label="Name" required><TextInput value={g.name} onChange={(v) => setGuardrail(i, { name: v })} placeholder="pii-input" mono /></Field>
              <Field label="Settings (JSON)"><TextArea value={g.settingsJson} onChange={(v) => setGuardrail(i, { settingsJson: v })} rows={3} mono /></Field>
            </div>
          </div>
        ))}
        <button className="add" onClick={addGuardrail}>+ Add guardrail</button>
      </Section>

      <Section
        title="Cognition (PACT)"
        hint="What kind of reasoning this agent exposes, vendor-neutrally. Declarative only — not enforced by the runtime, by design (PACT §31). Provider/family are auto-derived from the Primary/Fallback model names in the Model section above (not Routing, which stays operational-only); override here if they differ."
      >
        <div className="grid two">
          <Field label="Modalities" hint="Comma-separated, e.g. text, image">
            <TextInput value={draft.cognition.modalitiesText} onChange={(v) => patchCognition({ modalitiesText: v })} placeholder="text, image" mono />
          </Field>
          <Field label="Cognitive capabilities" hint="Comma-separated, e.g. reasoning, planning">
            <TextInput value={draft.cognition.capabilitiesText} onChange={(v) => patchCognition({ capabilitiesText: v })} placeholder="reasoning, planning" mono />
          </Field>
        </div>

        <div className="sub">Primary model — semantic, not an alias like the Model section above</div>
        <div className="grid three">
          <Field label="Provider"><TextInput value={draft.cognition.primaryModel.provider} onChange={(v) => patchPrimaryModel({ provider: v })} placeholder="anthropic" mono /></Field>
          <Field label="Family"><TextInput value={draft.cognition.primaryModel.family} onChange={(v) => patchPrimaryModel({ family: v })} placeholder="claude" mono /></Field>
          <Field label="Name" hint="Optional concrete model"><TextInput value={draft.cognition.primaryModel.name} onChange={(v) => patchPrimaryModel({ name: v })} mono /></Field>
        </div>

        <div className="sub">Fallback model</div>
        <div className="grid three">
          <Field label="Provider"><TextInput value={draft.cognition.fallbackModel.provider} onChange={(v) => patchFallbackModel({ provider: v })} placeholder="openai" mono /></Field>
          <Field label="Family"><TextInput value={draft.cognition.fallbackModel.family} onChange={(v) => patchFallbackModel({ family: v })} placeholder="gpt" mono /></Field>
          <Field label="Name" hint="Optional concrete model"><TextInput value={draft.cognition.fallbackModel.name} onChange={(v) => patchFallbackModel({ name: v })} mono /></Field>
        </div>

        <div className="sub">Requirements — what the hosting substrate must provide, not what this agent offers</div>
        <div className="grid three">
          <Field label="Required modalities" hint="Comma-separated"><TextInput value={draft.cognition.requiredModalitiesText} onChange={(v) => patchCognition({ requiredModalitiesText: v })} placeholder="text" mono /></Field>
          <Field label="Required capabilities" hint="Comma-separated"><TextInput value={draft.cognition.requiredCapabilitiesText} onChange={(v) => patchCognition({ requiredCapabilitiesText: v })} placeholder="reasoning" mono /></Field>
          <Field label="Min context window" hint="Tokens"><TextInput value={draft.cognition.contextWindowMinimum} onChange={(v) => patchCognition({ contextWindowMinimum: v })} placeholder="64000" mono /></Field>
        </div>
      </Section>

      <Section
        title="Contract (PACT)"
        hint="Basic semantic conditions this agent claims to operate under. Declarative only — not a security control; use Allowed roles and Guardrails above for anything actually enforced."
      >
        <div className="grid two">
          <Field label="Autonomy level" hint="0 passive · 1 assistive · 2 recommending · 3 executing · 4 autonomous">
            <Select
              value={draft.contract.autonomyLevel}
              options={['', '0', '1', '2', '3', '4'] as const}
              onChange={(v) => patchContract({ autonomyLevel: v })}
            />
          </Field>
          <Field label="Permissions" hint="Comma-separated; claimed, not granted — no controlled vocabulary">
            <TextInput value={draft.contract.permissionsText} onChange={(v) => patchContract({ permissionsText: v })} placeholder="read_repository" mono />
          </Field>
        </div>
      </Section>

      <Section
        title="Interfaces (PACT)"
        hint="How another system may reach this agent, beyond the built-in A2A endpoint every agent already exposes at /.well-known/agent.json."
      >
        {draft.interfaces.length === 0 && <p className="empty">No additional interfaces declared.</p>}
        {draft.interfaces.map((e, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Interface {i + 1}</strong>
              <button className="link danger" onClick={() => removeInterface(i)}>remove</button>
            </div>
            <div className="grid three">
              <Field label="Protocol" required><TextInput value={e.protocol} onChange={(v) => setInterface(i, { protocol: v })} placeholder="a2a" mono /></Field>
              <Field label="Endpoint" required><TextInput value={e.endpoint} onChange={(v) => setInterface(i, { endpoint: v })} placeholder="https://.../.well-known/agent.json" mono /></Field>
              <Field label="Version"><TextInput value={e.version} onChange={(v) => setInterface(i, { version: v })} placeholder="1.0" mono /></Field>
            </div>
          </div>
        ))}
        <button className="add" onClick={addInterface}>+ Add interface</button>
      </Section>
    </div>
  )
}
