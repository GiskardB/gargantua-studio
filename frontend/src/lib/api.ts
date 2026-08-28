// Client for the Gargantua Studio backend.
//
// The backend owns manifest building/validation (against the shared agent-core
// model) and gateways the Control Plane. Every call degrades gracefully: if the
// backend is unreachable, callers fall back to local logic (buildManifest/toYaml)
// or to mocked platform data, and the UI shows an "offline" badge. The Studio is
// still useful without a running platform — it just can't publish or show live state.

import type { AgentDraft } from '../types/draft'
import type { SkillDraft } from '../types/skillDraft'

/** Skills the manifest actually references (by capability, default skill, or loadout). */
export function skillsForDraft(draft: AgentDraft, skills: SkillDraft[]): SkillDraft[] {
  const referenced = new Set<string>()
  draft.capabilities.forEach((c) => c.implementedBy && referenced.add(c.implementedBy))
  if (draft.defaultSkill) referenced.add(draft.defaultSkill)
  draft.loadout.skillsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => referenced.add(s))
  return skills.filter((s) => s.name && referenced.has(s.name))
}

// When VITE_STUDIO_API is *defined* (including an empty string) we honour it; only an
// entirely unset var falls back to the localhost dev default. Empty string means
// same-origin/relative — the mode the Docker Compose deployment uses: nginx serves the
// SPA and reverse-proxies /api and /actuator to the backend, so the browser needs no
// absolute URL and the app works regardless of host (localhost or a LAN IP like Cave's).
// Same origin by default: the backend serves this SPA and exposes /api on the same host
// (dev proxies /api → :8090, see vite.config). Override with VITE_STUDIO_API only for an
// unusual split deployment.
const configuredBase = import.meta.env.VITE_STUDIO_API as string | undefined
const BASE: string =
  configuredBase !== undefined ? configuredBase.replace(/\/$/, '') : ''

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

/** Control Plane's liveness, relayed through the Studio backend — distinct from `checkHealth`. */
export async function checkControlPlaneHealth(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/api/studio/control-plane/health')
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

/**
 * Fetch a published workload's manifest, already turned into a form draft by the
 * backend (the exact inverse of what publish sends). Throws (via `request`) on a 404
 * — the caller decides how to surface "that version doesn't exist".
 */
export function getWorkloadDraft(name: string, version: string): Promise<AgentDraft> {
  return request<AgentDraft>(
    `/api/studio/workloads/${encodeURIComponent(name)}/${encodeURIComponent(version)}/draft`,
  )
}

/**
 * Builds the exact .gbundle the Control Plane would assemble on publish, entirely
 * locally — no Control Plane involved. Returns the raw bytes and the server-suggested
 * filename; the caller triggers the browser download. Throws with the validation
 * errors joined into the message on a 400.
 */
export async function downloadBundle(
  draft: AgentDraft,
  skills: SkillDraft[] = [],
): Promise<{ blob: Blob; filename: string }> {
  let res: Response
  try {
    res = await fetch(BASE + '/api/studio/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, skills }),
    })
  } catch {
    throw new OfflineError(`cannot reach Studio backend at ${BASE}`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.errors?.join('; ') ?? body?.message ?? res.statusText)
  }
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${draft.metadata.name || 'agent'}.gbundle`
  return { blob: await res.blob(), filename }
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

export interface SavedSkill {
  id: string
  name: string | null
  version: string | null
  updatedAt: string
  draft: SkillDraft
}

/** Durable skill drafts (a skill is still not published — this is editing state only). */
export function listSkills(): Promise<SavedSkill[]> {
  return request<SavedSkill[]>('/api/studio/skills')
}

export function createSkill(draft: SkillDraft): Promise<SavedSkill> {
  return request<SavedSkill>('/api/studio/skills', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
}

export function updateSkill(id: string, draft: SkillDraft): Promise<SavedSkill> {
  return request<SavedSkill>(`/api/studio/skills/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  })
}

/** Copies a skill server-side under a new id (name gets a "-copy" suffix). */
export function duplicateSkill(id: string): Promise<SavedSkill> {
  return request<SavedSkill>(`/api/studio/skills/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  })
}

export function deleteSkill(id: string): Promise<void> {
  return request<void>(`/api/studio/skills/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * Build then publish to the Control Plane Registry via the backend. Skills the manifest
 * references are sent alongside so the Control Plane can assemble a runnable bundle.
 */
export function publishDraft(draft: AgentDraft, skills: SkillDraft[] = []): Promise<unknown> {
  return request<unknown>('/api/studio/publish', {
    method: 'POST',
    body: JSON.stringify({ ...draft, skills }),
  })
}

// ---- launch (start a published agent on a Runtime) --------------------------

export interface LaunchResult {
  exitCode: number
  command: string
  output: string
}

export function getLaunchCommand(): Promise<{ template: string }> {
  return request<{ template: string }>('/api/studio/launch-command')
}

export function setLaunchCommand(template: string): Promise<{ template: string }> {
  return request<{ template: string }>('/api/studio/launch-command', {
    method: 'PUT',
    body: JSON.stringify({ template }),
  })
}

export function launchAgent(name: string, version: string): Promise<LaunchResult> {
  return request<LaunchResult>('/api/studio/launch', {
    method: 'POST',
    body: JSON.stringify({ name, version }),
  })
}

// ---- runtime (test a running agent directly) --------------------------------

export interface RuntimeChatResponse {
  text: string
  sessionId: string
  skillUsed: string
  toolsCalled: string[]
  routingMethod: string
  routingConfidence: number
  totalTokens: number
  durationMs: number
}

/** Raised when a Runtime cannot be reached — distinct from the Studio backend being down. */
export class RuntimeOfflineError extends Error {}

async function runtimeRequest<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const url = base.replace(/\/$/, '') + path
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new RuntimeOfflineError(`cannot reach the Runtime at ${base}`)
  }
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(`${res.status} ${body?.message ?? body?.error ?? res.statusText}`)
  }
  return body as T
}

export function runtimeChat(
  base: string,
  message: string,
  userId: string,
  sessionId: string,
  roles = '',
): Promise<RuntimeChatResponse> {
  const headers: Record<string, string> = { 'X-User-Id': userId, 'X-Session-Id': sessionId }
  if (roles.trim()) headers['X-User-Roles'] = roles.trim()
  return runtimeRequest<RuntimeChatResponse>(base, '/api/agent/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
}

export interface RuntimeTrace {
  traceId: string
  agentId: string
  sessionId: string
  events: {
    sequence: number
    type: string
    phase?: string
    message: string
    durationMs?: number
    attributes?: Record<string, unknown>
  }[]
}

export function runtimeTraces(base: string, limit = 20): Promise<RuntimeTrace[]> {
  return runtimeRequest<RuntimeTrace[]>(base, `/api/traces?limit=${limit}`)
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

export function getPolicies(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/policies')
}

export function getDeployments(): Promise<unknown[]> {
  return request<unknown[]>('/api/studio/deployments')
}

/** Delete a published workload version. Rejects (409, via the thrown Error) if still deployed. */
export function deleteWorkload(name: string, version: string): Promise<void> {
  return request<void>(`/api/studio/workloads/${encodeURIComponent(name)}/${encodeURIComponent(version)}`, {
    method: 'DELETE',
  })
}
