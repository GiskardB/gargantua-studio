// The Runtime a user tests against. Unlike the Studio backend (one, same-origin), a
// Runtime is per-agent and its address varies, so we let the user set it and remember it
// in localStorage. Default is the compose slice's published runtime port.

import { create } from 'zustand'

const KEY = 'gargantua.runtimeUrl'
const DEFAULT = 'http://localhost:18100'

interface RuntimeState {
  runtimeUrl: string
  setRuntimeUrl: (url: string) => void
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  runtimeUrl: localStorage.getItem(KEY) ?? DEFAULT,
  setRuntimeUrl: (url) => {
    localStorage.setItem(KEY, url)
    set({ runtimeUrl: url })
  },
}))
