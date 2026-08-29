// Shared manifest build + publish state for the Agent Designer. Pulled out of the
// preview component so the "Save & Publish" button can live in the screen's action
// bar while the YAML/errors it acts on stay a single source of truth (one debounced
// build call, not one per consumer).

import { useEffect, useRef, useState } from 'react'
import type { AgentDraft } from '../types/draft'
import { buildManifest as buildLocal } from './buildManifest'
import { toYaml } from './toYaml'
import { validateDraft } from './validate'
import { buildManifest as buildRemote, OfflineError, publishDraft, skillsForDraft } from './api'
import { useSkillsStore } from '../store/skillsStore'

export type BuildSource = 'backend' | 'local'

function localBuild(draft: AgentDraft): { yaml: string; errors: string[] } {
  const issues = validateDraft(draft)
  return {
    yaml: toYaml(buildLocal(draft)),
    errors: issues.filter((i) => i.severity === 'error').map((i) => `${i.path}: ${i.message}`),
  }
}

export function useManifestBuild(draft: AgentDraft) {
  const [yaml, setYaml] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [source, setSource] = useState<BuildSource>('local')
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const timer = setTimeout(async () => {
      try {
        const res = await buildRemote(draft)
        if (id !== seq.current) return
        setSource('backend')
        setYaml(res.yaml ?? '')
        setErrors(res.errors)
      } catch {
        if (id !== seq.current) return
        const local = localBuild(draft)
        setSource('local')
        setYaml(local.yaml)
        setErrors(local.errors)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [draft])

  return { yaml, errors, source, valid: errors.length === 0 }
}

export interface PublishNote {
  tone: string
  text: string
}

export function usePublish(draft: AgentDraft, yaml: string) {
  const [publishState, setPublishState] = useState<PublishNote | null>(null)

  /** Returns whether the publish succeeded, so the caller can navigate away on success. */
  const publish = async (): Promise<boolean> => {
    setPublishState({ tone: 'info', text: 'Publishing…' })
    try {
      const skills = skillsForDraft(draft, useSkillsStore.getState().skills.map((e) => e.draft))
      await publishDraft(draft, skills)
      setPublishState({ tone: 'good', text: `Published ${draft.metadata.name}@${draft.metadata.version}` })
      return true
    } catch (e) {
      const msg = e instanceof OfflineError ? 'Backend offline — cannot publish' : (e as Error).message
      setPublishState({ tone: 'bad', text: msg })
      return false
    }
  }

  // A fresh edit after a successful publish invalidates the note — it described content
  // that's no longer what's on screen.
  useEffect(() => {
    setPublishState(null)
  }, [yaml])

  return { publishState, publish }
}
