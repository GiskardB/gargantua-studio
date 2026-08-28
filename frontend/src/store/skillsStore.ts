// Skills authored in this session, durable via the Studio backend (a skill is still not
// published anywhere — it's bundle content the Runtime loads from skills/<name>/SKILL.md
// — but it now survives a reload and can be duplicated). Assigning a skill to an agent
// happens only in the Agent Designer's Capabilities section now, by picking a skill name
// as `implementedBy`; this store no longer knows about agent drafts at all.

import { create } from 'zustand'
import type { SkillDraft } from '../types/skillDraft'
import { emptySkillDraft, sampleSkillDraft } from '../types/skillDraft'
import { listSkills, createSkill, updateSkill, duplicateSkill, deleteSkill } from '../lib/api'

export interface SkillEntry {
  id: string
  draft: SkillDraft
  persisted: boolean // false until the first successful Save
}

type Source = 'live' | 'offline' | 'loading'

interface SkillsState {
  skills: SkillEntry[]
  selectedId: string | null
  source: Source
  loadFromServer: () => Promise<void>
  addBlank: () => string
  addSample: () => string
  update: (id: string, next: SkillDraft) => void
  save: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  select: (id: string) => void
}

function newId(): string {
  return `skill-${Math.random().toString(36).slice(2, 10)}`
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  selectedId: null,
  source: 'loading',

  loadFromServer: async () => {
    try {
      const saved = await listSkills()
      const skills = saved.map((s) => ({ id: s.id, draft: s.draft, persisted: true }))
      set({
        skills,
        selectedId: skills[0]?.id ?? null,
        source: 'live',
      })
    } catch {
      // Offline: seed one local-only sample so the designer is still usable.
      const id = 'skill-sample'
      set({ skills: [{ id, draft: sampleSkillDraft(), persisted: false }], selectedId: id, source: 'offline' })
    }
  },

  addBlank: () => {
    const id = newId()
    set((s) => ({ skills: [...s.skills, { id, draft: emptySkillDraft(), persisted: false }], selectedId: id }))
    return id
  },

  addSample: () => {
    const id = newId()
    set((s) => ({ skills: [...s.skills, { id, draft: sampleSkillDraft(), persisted: false }], selectedId: id }))
    return id
  },

  update: (id, next) =>
    set((s) => ({
      skills: s.skills.map((e) => (e.id === id ? { ...e, draft: next } : e)),
    })),

  save: async (id) => {
    const entry = get().skills.find((e) => e.id === id)
    if (!entry) return
    const saved = entry.persisted
      ? await updateSkill(id, entry.draft)
      : await createSkill(entry.draft)
    set((s) => ({
      skills: s.skills.map((e) => (e.id === id ? { id: saved.id, draft: saved.draft, persisted: true } : e)),
      selectedId: s.selectedId === id ? saved.id : s.selectedId,
    }))
  },

  duplicate: async (id) => {
    const entry = get().skills.find((e) => e.id === id)
    if (!entry) return
    if (entry.persisted) {
      const saved = await duplicateSkill(id)
      const copy = { id: saved.id, draft: saved.draft, persisted: true }
      set((s) => ({ skills: [...s.skills, copy], selectedId: copy.id }))
    } else {
      // Never saved yet — clone locally, same "-copy" convention as the server does.
      const copy = {
        id: newId(),
        draft: { ...entry.draft, name: entry.draft.name ? `${entry.draft.name}-copy` : entry.draft.name },
        persisted: false,
      }
      set((s) => ({ skills: [...s.skills, copy], selectedId: copy.id }))
    }
  },

  remove: async (id) => {
    const entry = get().skills.find((e) => e.id === id)
    if (entry?.persisted) {
      await deleteSkill(id).catch(() => {})
    }
    set((s) => {
      const skills = s.skills.filter((e) => e.id !== id)
      const selectedId = s.selectedId === id ? (skills[0]?.id ?? null) : s.selectedId
      return { skills, selectedId }
    })
  },

  select: (id) => set({ selectedId: id }),
}))
