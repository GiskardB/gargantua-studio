// Live SKILL.md preview + validation. Unlike the manifest, there is no local fallback
// builder for a skill — SkillMeta/SkillCard validation is real domain logic, not worth
// re-implementing client-side just to degrade gracefully. Offline simply means no preview.

import { useEffect, useRef, useState } from 'react'
import type { SkillDraft } from '../types/skillDraft'
import { buildSkill, OfflineError } from '../lib/api'
import { CodeEditor } from './CodeEditor'

interface Props {
  draft: SkillDraft
  onAssign: () => void
}

export function SkillPreview({ draft, onAssign }: Props) {
  const [markdown, setMarkdown] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [offline, setOffline] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    const timer = setTimeout(async () => {
      try {
        const res = await buildSkill(draft)
        if (id !== seq.current) return
        setOffline(false)
        setMarkdown(res.markdown ?? '')
        setErrors(res.errors)
      } catch (e) {
        if (id !== seq.current) return
        setOffline(true)
        setMarkdown('')
        setErrors(e instanceof OfflineError ? [] : [(e as Error).message])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [draft])

  const valid = !offline && errors.length === 0 && markdown !== ''
  const filename = `SKILL.md`

  const copy = () => void navigator.clipboard?.writeText(markdown)

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="preview">
      <div className="preview-head">
        <h2>SKILL.md</h2>
        <div className="preview-actions">
          {offline ? (
            <span className="badge neutral">backend offline</span>
          ) : (
            <span className={valid ? 'badge good' : 'badge bad'}>
              {valid ? 'valid' : `${errors.length} error${errors.length > 1 ? 's' : ''}`}
            </span>
          )}
          <button onClick={copy} disabled={!valid}>Copy</button>
          <button onClick={download} disabled={!valid}>Export</button>
          <button
            className="primary"
            onClick={onAssign}
            disabled={!valid}
            title="Add or update a capability implemented by this skill on the current agent draft"
          >
            Assign to agent
          </button>
        </div>
      </div>

      {offline && (
        <p className="preview-foot">
          Skill validation needs the Studio backend — start it and this preview will build
          against the shared <code>agent-core</code> skill model.
        </p>
      )}

      {errors.length > 0 && (
        <ul className="issues">
          {errors.map((msg, i) => (
            <li key={i} className="error">
              <span className="issue-sev">error</span>
              <span className="issue-msg">{msg}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="yaml-editor">
        <CodeEditor value={markdown} language="markdown" readOnly />
      </div>

      <p className="preview-foot">
        Built and validated by the Studio backend against the shared <code>agent-core</code>{' '}
        skill model. Place the file at <code>skills/{draft.name || '<name>'}/SKILL.md</code>{' '}
        in the bundle.
      </p>
    </div>
  )
}
