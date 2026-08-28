// The Agent Designer's draft, held in a Zustand store instead of App-level useState.
// A store (rather than prop-drilling) lets the form, the live preview and the graph
// view read and update the same draft without the screen having to thread it through.

import { create } from 'zustand'
import type { AgentDraft } from '../types/draft'
import { emptyDraft, sampleDraft } from '../types/draft'

interface DraftState {
  draft: AgentDraft
  setDraft: (next: AgentDraft) => void
  loadSample: () => void
  clear: () => void
}

export const useDraftStore = create<DraftState>((set) => ({
  draft: emptyDraft(),
  setDraft: (draft) => set({ draft }),
  loadSample: () => set({ draft: sampleDraft() }),
  clear: () => set({ draft: emptyDraft() }),
}))
