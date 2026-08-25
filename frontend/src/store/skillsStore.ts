// Skills authored in this session. Unlike the agent draft, a skill is not published
// anywhere — it's bundle content (SKILL.md) the user copies into skills/<name>/ or
// assigns to the current agent draft (which upserts a matching Capability, see
// draftStore.assignSkillAsCapability). Kept client-side only; no backend persistence
// yet, matching the Studio backend's current scope.

import { create } from 'zustand'
import type { SkillDraft } from '../types/skillDraft'
import { emptySkillDraft, sampleSkillDraft } from '../types/skillDraft'

export interface SkillEntry {
  id: string
  draft: SkillDraft
}

interface SkillsState {
  skills: SkillEntry[]
  selectedId: string | null
  addBlank: () => string
  addSample: () => string
  update: (id: string, next: SkillDraft) => void
  remove: (id: string) => void
  select: (id: string) => void
}

function newId(): string {
  return `skill-${Math.random().toString(36).slice(2, 10)}`
}

export const useSkillsStore = create<SkillsState>((set) => ({
  skills: [{ id: 'skill-sample', draft: sampleSkillDraft() }],
  selectedId: 'skill-sample',

  addBlank: () => {
    const id = newId()
    set((s) => ({ skills: [...s.skills, { id, draft: emptySkillDraft() }], selectedId: id }))
    return id
  },

  addSample: () => {
    const id = newId()
    set((s) => ({ skills: [...s.skills, { id, draft: sampleSkillDraft() }], selectedId: id }))
    return id
  },

  update: (id, next) =>
    set((s) => ({
      skills: s.skills.map((e) => (e.id === id ? { ...e, draft: next } : e)),
    })),

  remove: (id) =>
    set((s) => {
      const skills = s.skills.filter((e) => e.id !== id)
      const selectedId = s.selectedId === id ? (skills[0]?.id ?? null) : s.selectedId
      return { skills, selectedId }
    }),

  select: (id) => set({ selectedId: id }),
}))
