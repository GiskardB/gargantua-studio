// The Agent Designer's draft, held in a Zustand store instead of App-level useState.
// A store (rather than prop-drilling) lets the form, the live preview and the graph
// view read and update the same draft without the screen having to thread it through.

import { create } from 'zustand'
import type { AgentDraft, CapabilityDraft } from '../types/draft'
import { emptyDraft, sampleDraft } from '../types/draft'
import type { SkillDraft } from '../types/skillDraft'

interface DraftState {
  draft: AgentDraft
  setDraft: (next: AgentDraft) => void
  loadSample: () => void
  clear: () => void
  assignSkillAsCapability: (skill: SkillDraft) => void
}

// A capability is the external contract the Catalog indexes; a skill is the internal
// implementation (system prompt, tools). They're deliberately decoupled in the domain
// model — but authoring a skill is the common path to "the agent can now do this", so
// assigning a skill upserts a matching capability (by `implementedBy`) instead of
// requiring it to be typed twice. The result stays a normal, editable capability row.
function capabilityFromSkill(skill: SkillDraft): CapabilityDraft {
  return {
    name: skill.name,
    description: skill.description,
    version: skill.version,
    implementedBy: skill.name,
    inputSchema: '',
    outputSchema: skill.outputSchema,
    tags: '',
  }
}

export const useDraftStore = create<DraftState>((set, get) => ({
  draft: emptyDraft(),
  setDraft: (draft) => set({ draft }),
  loadSample: () => set({ draft: sampleDraft() }),
  clear: () => set({ draft: emptyDraft() }),

  assignSkillAsCapability: (skill) => {
    const draft = get().draft
    const next = capabilityFromSkill(skill)
    const i = draft.capabilities.findIndex((c) => c.implementedBy === skill.name)
    const capabilities =
      i === -1
        ? [...draft.capabilities, next]
        : draft.capabilities.map((c, idx) => (idx === i ? next : c))
    set({ draft: { ...draft, capabilities } })
  },
}))
