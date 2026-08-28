// The Skill Designer: a structured form over SkillDraft, one block per SKILL.md
// frontmatter concern. State lives in the skills store; this component only reads a
// draft and emits a new one, so the SKILL.md preview stays in sync with no extra wiring.

import type { SkillDraft } from '../types/skillDraft'
import { MEMORY_LAYERS, type MemoryLayer } from '../types/manifest'
import { Section, Field, TextInput, TextArea, Checkbox } from './fields'
import { ReferenceFileUpload } from './ReferenceFileUpload'

interface Props {
  draft: SkillDraft
  onChange: (next: SkillDraft) => void
}

export function SkillDesigner({ draft, onChange }: Props) {
  const patch = (partial: Partial<SkillDraft>) => onChange({ ...draft, ...partial })

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
      <Section title="Metadata" hint="Identity of the skill — the folder name must match `name`.">
        <div className="grid three">
          <Field label="Name" required>
            <TextInput value={draft.name} onChange={(v) => patch({ name: v })} placeholder="weather-skill" mono />
          </Field>
          <Field label="Version" required>
            <TextInput value={draft.version} onChange={(v) => patch({ version: v })} placeholder="1.0.0" mono />
          </Field>
          <Field label="Domain" hint="Logical grouping, defaults to 'general'">
            <TextInput value={draft.domain} onChange={(v) => patch({ domain: v })} placeholder="weather" />
          </Field>
        </div>
        <Field label="Description" required hint="Used by the semantic router for matching">
          <TextInput
            value={draft.description}
            onChange={(v) => patch({ description: v })}
            placeholder="Answers weather-related questions using real-time data"
          />
        </Field>
        <Checkbox checked={draft.active} onChange={(v) => patch({ active: v })} label="Active (available for routing)" />
      </Section>

      <Section title="Behavior" hint="The markdown body becomes the LLM system prompt verbatim.">
        <Field label="System prompt" required>
          <TextArea
            value={draft.systemPrompt}
            onChange={(v) => patch({ systemPrompt: v })}
            rows={10}
            placeholder="You are a weather assistant. Use the provided tools to answer questions…"
          />
        </Field>
        <Field label="Allowed tools" required hint="One per line — the only tools this skill may call">
          <TextArea
            value={draft.allowedToolsText}
            onChange={(v) => patch({ allowedToolsText: v })}
            rows={3}
            mono
            placeholder={'getWeather\ngetWeatherForecast'}
          />
        </Field>
      </Section>

      <Section title="Model overrides" hint="Leave blank to inherit the runtime defaults.">
        <div className="grid three">
          <Field label="Preferred model">
            <TextInput value={draft.preferredModel} onChange={(v) => patch({ preferredModel: v })} placeholder="claude-sonnet-4-20250514" mono />
          </Field>
          <Field label="Max tokens">
            <TextInput value={draft.maxTokens} onChange={(v) => patch({ maxTokens: v })} placeholder="1024" mono />
          </Field>
          <Field label="Temperature">
            <TextInput value={draft.temperature} onChange={(v) => patch({ temperature: v })} placeholder="0.2" mono />
          </Field>
        </div>
      </Section>

      <Section title="Knowledge & memory">
        <Field label="Output schema" hint="Bundle-relative path or inline JSON Schema">
          <TextInput value={draft.outputSchema} onChange={(v) => patch({ outputSchema: v })} placeholder="assets/schema.json" mono />
        </Field>
        <div className="grid three">
          <Field label="Knowledge base" hint="Vector store collection name — enables RAG">
            <TextInput value={draft.knowledgeBase} onChange={(v) => patch({ knowledgeBase: v })} placeholder="weather-kb" mono />
          </Field>
          <Field label="RAG max results" hint="Default 5">
            <TextInput value={draft.ragMaxResults} onChange={(v) => patch({ ragMaxResults: v })} mono />
          </Field>
          <Field label="RAG min score" hint="Default 0.3">
            <TextInput value={draft.ragMinScore} onChange={(v) => patch({ ragMinScore: v })} mono />
          </Field>
        </div>
        <Field label="Memory layers" hint="None selected = fetch all layers">
          <div className="chips">
            {MEMORY_LAYERS.map((l) => (
              <Checkbox key={l} checked={draft.memoryLayers.includes(l)} onChange={() => toggleLayer(l)} label={l} />
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Access & discovery">
        <Field label="Allowed roles" hint="Comma-separated, empty = no restriction">
          <TextInput value={draft.allowedRolesText} onChange={(v) => patch({ allowedRolesText: v })} placeholder="support-agent, super-admin" />
        </Field>
        <Field label="References" hint="One opaque note per line — NOT a file path, stored and appended verbatim. Upload actual files below.">
          <TextArea value={draft.referencesText} onChange={(v) => patch({ referencesText: v })} rows={2} mono />
        </Field>
        <Field label="Examples" hint="One example prompt per line, surfaced via the A2A Agent Card">
          <TextArea value={draft.examplesText} onChange={(v) => patch({ examplesText: v })} rows={2} />
        </Field>
        <Field
          label="Reference files"
          hint="Shipped as skills/<name>/references/<filename> in the bundle — the Runtime reads every file here and appends its content to the prompt. Text files only."
        >
          <ReferenceFileUpload files={draft.referenceFiles} onChange={(referenceFiles) => patch({ referenceFiles })} />
        </Field>
      </Section>
    </div>
  )
}
