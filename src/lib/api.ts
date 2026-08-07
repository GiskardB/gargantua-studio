// Client for the Gargantua Studio backend.
//
// The backend owns manifest building/validation (against the shared agent-core
// model) and gateways the Control Plane. Every call degrades gracefully: if the
// backend is unreachable, callers fall back to local logic (buildManifest/toYaml)
// or to mocked platform data, and the UI shows an "offline" badge. The Studio is
// still useful without a running platform — it just can't publish or show live state.

import type { AgentDraft } from '../types/draft'
import type { SkillDraft } from '../types/skillDraft'

// When VITE_STUDIO_API is *defined* (including an empty string) we honour it; only an
// entirely unset var falls back to the localhost dev default. Empty string means
// same-origin/relative — the mode the Docker Compose deployment uses: nginx serves the
// SPA and reverse-proxies /api and /actuator to the backend, so the browser needs no
// absolute URL and the app works regardless of host (localhost or a LAN IP like Cave's).
const configuredBase = import.meta.env.VITE_STUDIO_API as string | undefined
const BASE: string =
  configuredBase !== undefined ? configuredBase.replace(/\/$/, '') : 'http://localhost:8090'

export const apiBaseUrl = BASE

export interface BuildResult {
  valid: boolean
  yaml: string | null
  errors: string[]
}

export interface SavedDraft {
  id: string
  name: string | null
  version: string | null
  updatedAt: string
  draft: AgentDraft
}

/** Raised when the backend cannot be reached — callers treat this as "offline". */
export class OfflineError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch (e) {
    throw new OfflineError(`cannot reach Studio backend at ${BASE}`)
  }
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? res.statusText
    throw new Error(`${res.status} ${message}`)
  }
  return body as T
}

/** Liveness probe used to drive the online/offline indicator. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/actuator/health')
    return res.ok
  } catch {
    return false
  }
}

// ---- manifest ---------------------------------------------------------------

export function buildManifest(draft: AgentDraft): Promise<BuildResult> {
  return request<BuildResult>('/api/studio/manifest/build', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

// ---- skill --------------------------------------------------------------------

export interface SkillBuildResult {
  valid: boolean
  markdown: string | null
  errors: string[]
}

/** Build the canonical SKILL.md — no publish step, a skill is bundle content. */
export function buildSkill(draft: SkillDraft): Promise<SkillBuildResult> {
  return request<SkillBuildResult>('/api/studio/skill/build', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

/** Build then publish to the Control Plane Registry via the backend. */
export function publishDraft(draft: AgentDraft): Promise<unknown> {
  return request<unknown>('/api/studio/publish', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

// ---- drafts -----------------------------------------------------------------

export function listDrafts(): Promise<SavedDraft[]> {
  return request<SavedDraft[]>('/api/studio/drafts')
}

export function saveDraft(draft: AgentDraft): Promise<SavedDraft> {
  return request<SavedDraft>('/api/studio/drafts', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

// ---- platform read-through (Control Plane) ----------------------------------

export function getWorkloads(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/workloads')
}

export function getCapabilities(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/capabilities')
}

export function getPolicies(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/policies')
}

export function getDeployments(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/deployments')
}
