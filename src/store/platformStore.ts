// Live platform state, read through the Studio backend from the Control Plane.
//
// The store tracks connectivity and caches what the backend returns. Screens read
// `workloads`/`capabilities` when online and fall back to mocked data when offline,
// using `source` to show an honest "live" vs "sample data" badge. Fields the Control
// Plane does not (yet) report are left at neutral placeholders rather than invented.

import { create } from 'zustand'
import {
  checkHealth,
  getCapabilities,
  getWorkloads,
} from '../lib/api'
import type { CapabilityRow, WorkloadKind, WorkloadRow } from '../mock/data'

type Source = 'live' | 'mock' | 'loading'

interface PlatformState {
  online: boolean | null
  source: Source
  workloads: WorkloadRow[] | null
  capabilities: CapabilityRow[] | null
  refresh: () => Promise<void>
}

// ---- Control Plane response → screen row shapes -----------------------------

interface CpBundle {
  descriptor: {
    name: string
    version: string
    kind: WorkloadKind
    capabilities?: unknown[]
    labels?: Record<string, string>
    createdAt?: string
  }
  environments?: string[]
}

interface CpCapability {
  name: string
  description?: string
  providers?: string[]
}

function mapWorkloads(raw: unknown[]): WorkloadRow[] {
  return (raw as CpBundle[]).map((b) => {
    const envs = b.environments ?? []
    const state = envs.includes('PRODUCTION')
      ? 'running'
      : envs.includes('STAGING')
        ? 'canary'
        : 'draft'
    return {
      name: b.descriptor.name,
      kind: b.descriptor.kind,
      version: b.descriptor.version,
      owner: b.descriptor.labels?.owner ?? b.descriptor.labels?.team ?? '—',
      state,
      health: 'healthy',
      capabilities: b.descriptor.capabilities?.length ?? 0,
      updated: 'published',
    }
  })
}

function mapCapabilities(raw: unknown[]): CapabilityRow[] {
  return (raw as CpCapability[]).map((c) => ({
    name: c.name,
    version: '—',
    description: c.description ?? '',
    implementedBy: c.providers ?? [],
    tags: [],
    health: 'healthy',
    callsPerDay: 0,
  }))
}

export const usePlatformStore = create<PlatformState>((set) => ({
  online: null,
  source: 'loading',
  workloads: null,
  capabilities: null,
  refresh: async () => {
    const healthy = await checkHealth()
    if (!healthy) {
      set({ online: false, source: 'mock', workloads: null, capabilities: null })
      return
    }
    try {
      const [wl, caps] = await Promise.all([getWorkloads(), getCapabilities()])
      set({
        online: true,
        source: 'live',
        workloads: mapWorkloads(wl),
        capabilities: mapCapabilities(caps),
      })
    } catch {
      // Backend is up but the Control Plane is not — fall back to sample data.
      set({ online: false, source: 'mock', workloads: null, capabilities: null })
    }
  },
}))
