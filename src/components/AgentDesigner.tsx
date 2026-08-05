// The Agent Designer: a structured form over AgentDraft. Every section maps to a
// block of the gargantua.ai/v1 spec. State lives one level up in App; this
// component only reads the draft and emits a new one, so the manifest preview
// stays in sync with no extra wiring.

import type { AgentDraft, CapabilityDraft, McpServerDraft, GuardrailDraft } from '../types/draft'
import { emptyCapability, emptyMcpServer, emptyGuardrail } from '../types/draft'
import {
  MCP_TRANSPORTS,
  MCP_AUTH_TYPES,
  MEMORY_LAYERS,
  type MemoryLayer,
} from '../types/manifest'
import { Section, Field, TextInput, TextArea, Select, Checkbox } from './fields'

interface Props {
  draft: AgentDraft
  onChange: (next: AgentDraft) => void
}

export function AgentDesigner({ draft, onChange }: Props) {
  // ---- top-level patch helpers ----
  const patch = (partial: Partial<AgentDraft>) => onChange({ ...draft, ...partial })
  const patchMeta = (partial: Partial<AgentDraft['metadata']>) =>
    patch({ metadata: { ...draft.metadata, ...partial } })
  const patchRuntime = (partial: Partial<AgentDraft['runtime']>) =>
    patch({ runtime: { ...draft.runtime, ...partial } })
  const patchModel = (partial: Partial<AgentDraft['model']>) =>
    patch({ model: { ...draft.model, ...partial } })

  // ---- capabilities ----
  const setCapability = (i: number, partial: Partial<CapabilityDraft>) =>
    patch({
      capabilities: draft.capabilities.map((c, idx) =>
        idx === i ? { ...c, ...partial } : c,
      ),
    })
  const addCapability = () =>
    patch({ capabilities: [...draft.capabilities, emptyCapability()] })
  const removeCapability = (i: number) =>
    patch({ capabilities: draft.capabilities.filter((_, idx) => idx !== i) })

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
          <Field label="Name" required hint="Stable across versions, e.g. customer-agent">
            <TextInput value={draft.metadata.name} onChange={(v) => patchMeta({ name: v })} placeholder="customer-agent" mono />
          </Field>
          <Field label="Version" required hint="Semver of this revision">
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

      <Section title="Model" hint="Model names only — endpoints and keys come from the runtime environment.">
        <div className="grid three">
          <Field label="Primary"><TextInput value={draft.model.primary} onChange={(v) => patchModel({ primary: v })} placeholder="gpt-4o" mono /></Field>
          <Field label="Fallback"><TextInput value={draft.model.fallback} onChange={(v) => patchModel({ fallback: v })} placeholder="claude-sonnet-4-20250514" mono /></Field>
          <Field label="Routing"><TextInput value={draft.model.routing} onChange={(v) => patchModel({ routing: v })} placeholder="phi4-mini" mono /></Field>
        </div>
        <div className="grid two">
          <Field label="Temperature" hint="0.0 – 2.0"><TextInput value={draft.model.temperature} onChange={(v) => patchModel({ temperature: v })} placeholder="0.7" mono /></Field>
          <Field label="Max tokens" hint="Positive integer"><TextInput value={draft.model.maxTokens} onChange={(v) => patchModel({ maxTokens: v })} placeholder="1000" mono /></Field>
        </div>
      </Section>

      <Section title="Capabilities" hint="The external contract callers route on — not the agent name.">
        {draft.capabilities.length === 0 && <p className="empty">No capabilities yet.</p>}
        {draft.capabilities.map((c, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <strong>Capability {i + 1}</strong>
              <button className="link danger" onClick={() => removeCapability(i)}>remove</button>
            </div>
            <div className="grid three">
              <Field label="Name" required><TextInput value={c.name} onChange={(v) => setCapability(i, { name: v })} placeholder="refund-payment" mono /></Field>
              <Field label="Version" required><TextInput value={c.version} onChange={(v) => setCapability(i, { version: v })} placeholder="1.0.0" mono /></Field>
              <Field label="Implemented by" hint="Skill id (optional)"><TextInput value={c.implementedBy} onChange={(v) => setCapability(i, { implementedBy: v })} placeholder="refund-skill" mono /></Field>
            </div>
            <Field label="Description" required><TextInput value={c.description} onChange={(v) => setCapability(i, { description: v })} placeholder="Handles a payment refund request" /></Field>
            <div className="grid two">
              <Field label="Input schema" hint="Bundle path or inline JSON Schema"><TextInput value={c.inputSchema} onChange={(v) => setCapability(i, { inputSchema: v })} placeholder="schemas/refund-input.json" mono /></Field>
              <Field label="Output schema"><TextInput value={c.outputSchema} onChange={(v) => setCapability(i, { outputSchema: v })} placeholder="schemas/refund-output.json" mono /></Field>
            </div>
            <Field label="Tags" hint="Comma-separated"><TextInput value={c.tags} onChange={(v) => setCapability(i, { tags: v })} placeholder="payments, gdpr" /></Field>
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

      <Section title="Routing & roles">
        <div className="grid two">
          <Field label="Default skill" hint="Entry skill; binds to agent.routing.fallback-skill"><TextInput value={draft.defaultSkill} onChange={(v) => patch({ defaultSkill: v })} placeholder="default-skill" mono /></Field>
          <Field label="Allowed roles" hint="Comma-separated (reported, not yet enforced at workload level)"><TextInput value={draft.allowedRolesText} onChange={(v) => patch({ allowedRolesText: v })} placeholder="support-agent, super-admin" /></Field>
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
    </div>
  )
}
