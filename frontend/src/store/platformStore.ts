// Live platform state, read through the Studio backend from the Control Plane.
//
// The store tracks connectivity and caches what the backend returns. Screens read
// `workloads` when online and fall back to mocked data when offline, using `source`
// to show an honest "live" vs "sample data" badge. Fields the Control Plane does not
// (yet) report are left at neutral placeholders rather than invented.

import { create } from 'zustand'
import {
  checkControlPlaneHealth,
  checkHealth,
  getDeployments,
  getWorkloads,
} from '../lib/api'
import type { WorkloadKind, WorkloadRow } from '../mock/data'
import { compareVersions } from '../types/draft'

type Source = 'live' | 'mock' | 'loading'

export type DeploymentState = 'PENDING' | 'PROGRESSING' | 'HEALTHY' | 'FAILED'

export interface DeploymentRow {
  id: string
  bundleName: string
  bundleVersion: string
  environment: string
  strategy: string
  state: DeploymentState
  updatedAt: string
}

export interface SkillAssignment {
  name: string
  version: string
}

interface PlatformState {
  online: boolean | null
  cpOnline: boolean | null
  source: Source
  workloads: WorkloadRow[] | null
  deployments: DeploymentRow[] | null
  // skill name -> published agents (name/version) whose capabilities implement it —
  // read-only, derived from live Control Plane data. A skill is assigned to an agent
  // only by publishing a capability with `implementedBy` set to it (Agent Designer).
  skillAssignments: Record<string, SkillAssignment[]>
  refresh: () => Promise<void>
}

// ---- Control Plane response → screen row shapes -----------------------------

interface CpCapability {
  implementedBy?: string | null
}

interface CpBundle {
  descriptor: {
    name: string
    version: string
    kind: WorkloadKind
    capabilities?: CpCapability[]
    labels?: Record<string, string>
    createdAt?: string
  }
  environments?: string[]
}

// Versions are immutable on the Control Plane, so republishing an update adds a new
// bundle row rather than overwriting the old one. Only the latest version per name is
// shown here — otherwise every republish would look like a brand new workload next to
// the one it updates.
function latestPerName(rows: WorkloadRow[]): WorkloadRow[] {
  const byName = new Map<string, WorkloadRow>()
  for (const row of rows) {
    const current = byName.get(row.name)
    if (!current || compareVersions(row.version, current.version) > 0) byName.set(row.name, row)
  }
  return [...byName.values()]
}

function mapWorkloads(raw: unknown[]): WorkloadRow[] {
  const rows: WorkloadRow[] = (raw as CpBundle[]).map((b) => {
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
  return latestPerName(rows)
}

function mapSkillAssignments(raw: unknown[]): Record<string, SkillAssignment[]> {
  const out: Record<string, SkillAssignment[]> = {}
  for (const b of raw as CpBundle[]) {
    for (const cap of b.descriptor.capabilities ?? []) {
      const skill = cap.implementedBy
      if (!skill) continue
      const agent = { name: b.descriptor.name, version: b.descriptor.version }
      out[skill] = out[skill] ? [...out[skill], agent] : [agent]
    }
  }
  return out
}

interface CpDeployment {
  id: string
  bundleName: string
  bundleVersion: string
  environment: string
  strategy: string
  state: DeploymentState
  updatedAt: string
}

function mapDeployments(raw: unknown[]): DeploymentRow[] {
  return (raw as CpDeployment[]).map((d) => ({
    id: d.id,
    bundleName: d.bundleName,
    bundleVersion: d.bundleVersion,
    environment: d.environment,
    strategy: d.strategy,
    state: d.state,
    updatedAt: d.updatedAt,
  }))
}

export const usePlatformStore = create<PlatformState>((set) => ({
  online: null,
  cpOnline: null,
  source: 'loading',
  workloads: null,
  deployments: null,
  skillAssignments: {},
  refresh: async () => {
    const healthy = await checkHealth()
    if (!healthy) {
      set({ online: false, cpOnline: null, source: 'mock', workloads: null, deployments: null, skillAssignments: {} })
      return
    }
    const cpHealthy = await checkControlPlaneHealth()
    if (!cpHealthy) {
      set({ online: true, cpOnline: false, source: 'mock', workloads: null, deployments: null, skillAssignments: {} })
      return
    }
    try {
      const [wl, deps] = await Promise.all([getWorkloads(), getDeployments()])
      set({
        online: true,
        cpOnline: true,
        source: 'live',
        workloads: mapWorkloads(wl),
        deployments: mapDeployments(deps),
        skillAssignments: mapSkillAssignments(wl),
      })
    } catch {
      // Backend and Control Plane both answered health, but a read call still failed.
      set({ online: true, cpOnline: false, source: 'mock', workloads: null, deployments: null, skillAssignments: {} })
    }
  },
}))
