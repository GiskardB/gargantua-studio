// The Runtime a user tests against. Unlike the Studio backend (one, same-origin), a
// Runtime is per-agent and its address varies, so we let the user set it and remember it
// in localStorage. Default is the compose slice's published runtime port.

import { create } from 'zustand'

const KEY = 'gargantua.runtimeUrl'
const RUNTIME_PORT = 18100

// The runtime is exposed on the same host Studio itself was reached on — a hardcoded
// "localhost" only works when the browser and the Docker host are the same machine, which
// is false the moment Studio is opened from a LAN address or a phone. Match whatever host
// got the page loaded instead.
export function defaultRuntimeUrl(): string {
  return `${window.location.protocol}//${window.location.hostname}:${RUNTIME_PORT}`
}

interface RuntimeState {
  runtimeUrl: string
  setRuntimeUrl: (url: string) => void
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  runtimeUrl: localStorage.getItem(KEY) ?? defaultRuntimeUrl(),
  setRuntimeUrl: (url) => {
    localStorage.setItem(KEY, url)
    set({ runtimeUrl: url })
  },
}))
