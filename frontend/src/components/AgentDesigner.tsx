// The Agent Designer: a structured form over AgentDraft. State lives one level
// up in App; this component only reads the draft and emits a new one, so the
// manifest preview stays in sync with no extra wiring.
//
// Scope is deliberately narrow: this form only asks for what the Runtime
// actually applies (see gargantua's ManifestProperties.from/.unappliedFields) —
// Metadata, Governance's own fields, Runtime image, Model, Capabilities +
// Default skill, MCP servers, Guardrails, Memory layers (agent-wide as of
// 2026-09 — see AgentProperties.Memory#getEnabledLayers in gargantua; no
// longer a per-skill SKILL.md concern) — plus Interfaces, limited to A2A and
// MCP (the two protocols gargantua actually serves as an interface — A2A is
// always on regardless of what's checked; MCP server mode is a separate
// deploy-time flag, agent.mcp.enabled — checking the box here doesn't switch
// anything on, see the section hint). Everything else this form used to
// expose (Cognition, Contract, Memory scopes, Knowledge bases, Resources,
// extra equipped Skills, Allowed roles, Runtime min version) is a real field
// in the shared domain model and still round-trips through buildManifest.ts
// if a draft already has it set — it's just not authored from this UI,
// because a control that visibly does nothing is worse than no control at all.

import type {
  AgentDraft,
  CapabilityDraft,
  McpServerDraft,
  GuardrailDraft,
  GovernanceDraft,
  Visibility,
} from '../types/draft'
import {
  emptyCapability,
  emptyMcpServer,
  emptyGuardrail,
  applySkillToCapability,
} from '../types/draft'
import { MCP_TRANSPORTS, MCP_AUTH_TYPES, MEMORY_LAYERS, type MemoryLayer } from '../types/manifest'
import { Section, Field, TextInput, TextArea, Select, Checkbox } from './fields'
import { useSkillsStore } from '../store/skillsStore'

// Display-only labels — the wire value stays the real MemoryLayer enum
// (KNOWLEDGE), but "Knowledge" as a label collides with the unrelated
// Knowledge-base/RAG feature this form no longer even shows, so it's labelled
// for what it actually stores.
const MEMORY_LAYER_LABELS: Record<MemoryLayer, string> = {
  WORKING: 'Working',
  EPISODIC: 'Episodic',
  KNOWLEDGE: 'User profile',
}
const MEMORY_LAYER_HINTS: Record<MemoryLayer, string> = {
  WORKING: "This session's chat history (Redis)",
  EPISODIC: 'Compressed summaries of past sessions (MongoDB)',
  KNOWLEDGE: 'Stable user preferences (MongoDB)',
}

// The protocols a gargantua Runtime can actually serve today, with the real
// endpoint each one answers on (agent-engine CapabilitiesController,
// agent-runtime PactController, agent-engine ChatController, agent-mcp-server
// AgentMcpProperties' default transport path) — no free-text URL to get wrong.
const KNOWN_INTERFACES: { protocol: string; label: string; endpoint: string; hint: string }[] = [
  { protocol: 'a2a', label: 'A2A', endpoint: '/.well-known/agent.json', hint: 'Always served — checking this only documents it in the manifest' },
  { protocol: 'mcp', label: 'MCP server', endpoint: '/mcp', hint: 'Opt-in at deploy time (agent.mcp.enabled) — checking this here does not turn it on' },
]

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

  // ---- capabilities (the only place a skill is linked to this agent) ----
  const setCapability = (i: number, partial: Partial<CapabilityDraft>) =>
    patch({
      capabilities: draft.capabilities.map((c, idx) => (idx === i ? { ...c, ...partial } : c)),
    })
  const addCapability = () => patch({ capabilities: [...draft.capabilities, emptyCapability()] })
  const removeCapability = (i: number) =>
    patch({ capabilities: draft.capabilities.filter((_, idx) => idx !== i) })
  // A capability IS a skill: picking one derives every other field on the card.
  // Everything about it — including input schema and tags — is authored in the
  // Skill Designer, never here; this form only references a skill by name.
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

  // ---- memory layers (toggle set — see the section hint on enforcement scope) ----
  const toggleLayer = (layer: MemoryLayer) => {
    const has = draft.memoryLayers.includes(layer)
    patch({
      memoryLayers: has
        ? draft.memoryLayers.filter((l) => l !== layer)
        : [...draft.memoryLayers, layer],
    })
  }

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

  // ---- governance (tenant, visibility, status, ACL) ----
  const patchGovernance = (partial: Partial<GovernanceDraft>) =>
    patch({ governance: { ...draft.governance, ...partial } })

  // ---- interfaces (fixed checkbox set against KNOWN_INTERFACES, not free text) ----
  const toggleInterface = (known: (typeof KNOWN_INTERFACES)[number]) => {
    const has = draft.interfaces.some((i) => i.protocol === known.protocol)
    patch({
      interfaces: has
        ? draft.interfaces.filter((i) => i.protocol !== known.protocol)
        : [...draft.interfaces, { protocol: known.protocol, endpoint: known.endpoint, version: '' }],
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
        title="Governance & access"
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
        <Field label="Access (ACL)" hint="Who can discover/find this agent in the Catalog, beyond what Visibility implies">
          <TextInput value={draft.governance.accessText} onChange={(v) => patchGovernance({ accessText: v })} placeholder="ops, support" />
        </Field>
      </Section>

      <Section title="Runtime" hint="Which image the bundle needs. Leave blank for the platform default.">
        <Field label="Image" hint="Name a custom image only for library-mode Java tools">
          <TextInput value={draft.runtime.image} onChange={(v) => patchRuntime({ image: v })} placeholder="ghcr.io/giskardb/gargantua-runtime:1.0" mono />
        </Field>
      </Section>

      <Section title="Model" hint="Model names only — endpoints and keys come from the runtime environment. Applied by the runtime.">
        <div className="grid three">
          <Field label="Primary"><TextInput value={draft.model.primary} onChange={(v) => patchModel({ primary: v })} placeholder="gpt-4o" mono /></Field>
          <Field label="Fallback"><TextInput value={draft.model.fallback} onChange={(v) => patchModel({ fallback: v })} placeholder="claude-sonnet-4-20250514" mono /></Field>
          <Field label="Routing" hint="Small/cheap model used for intent routing"><TextInput value={draft.model.routing} onChange={(v) => patchModel({ routing: v })} placeholder="phi4-mini" mono /></Field>
        </div>
        <div className="grid two">
          <Field label="Temperature" hint="0.0 – 2.0"><TextInput value={draft.model.temperature} onChange={(v) => patchModel({ temperature: v })} placeholder="0.7" mono /></Field>
          <Field label="Max tokens" hint="Positive integer"><TextInput value={draft.model.maxTokens} onChange={(v) => patchModel({ maxTokens: v })} placeholder="1000" mono /></Field>
        </div>
      </Section>

      <Section
        title="Capabilities"
        hint="The external contract callers route on, plus which skill handles anything that doesn't match one. Every capability is a skill — pick one, written in the Skill Designer first. Editing a skill's content, input schema or tags happens there, never here; this form only references it by name."
      >
        <Field label="Default skill" hint="Fallback when nothing matches a capability — applied, binds to agent.routing.fallback-skill">
          <TextInput value={draft.defaultSkill} onChange={(v) => patch({ defaultSkill: v })} placeholder="default-skill" mono />
        </Field>

        {draft.capabilities.length === 0 && <p className="empty">No capabilities yet.</p>}
        {draft.capabilities.map((c, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Capability {i + 1}</strong>
              <button className="link danger" onClick={() => removeCapability(i)}>remove</button>
            </div>
            <Field label="Skill" required hint="Everything below is derived from the skill">
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

      <Section
        title="Memory"
        hint="Which memory tiers this agent uses (session/summaries/user profile, on Redis/MongoDB). Applied — binds onto agent.memory.layers, agent-wide for every skill this agent runs. Leave all unchecked to enable all three."
      >
        <div className="chips">
          {MEMORY_LAYERS.map((layer) => (
            <button
              key={layer}
              className={draft.memoryLayers.includes(layer) ? 'chip on' : 'chip'}
              onClick={() => toggleLayer(layer)}
              title={MEMORY_LAYER_HINTS[layer]}
            >
              {MEMORY_LAYER_LABELS[layer]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Guardrails" hint="Raw overrides keyed by guardrail name; each value is a JSON object. Applied — binds onto agent.guardrail.*.">
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
        title="Interfaces"
        hint="How this agent can be reached. A checklist, not a switch: gargantua doesn't read this to turn anything on or off. A2A is always served regardless of what's checked here; MCP server mode is a separate deploy-time flag (agent.mcp.enabled). Check what you want documented in the manifest."
      >
        {KNOWN_INTERFACES.map((known) => (
          <Checkbox
            key={known.protocol}
            checked={draft.interfaces.some((i) => i.protocol === known.protocol)}
            onChange={() => toggleInterface(known)}
            label={`${known.label} — ${known.hint}`}
          />
        ))}
      </Section>
    </div>
  )
}
