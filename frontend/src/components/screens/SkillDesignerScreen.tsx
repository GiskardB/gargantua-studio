import { useEffect, useState } from 'react'
import { SkillDesigner } from '../SkillDesigner'
import { SkillPreview } from '../SkillPreview'
import { Screen, Badge } from '../ui'
import { useSkillsStore } from '../../store/skillsStore'
import { usePlatformStore } from '../../store/platformStore'

// Skills are bundle content (SKILL.md), not manifest fields — authoring one here never
// publishes anything, and this screen no longer assigns a skill to an agent (that only
// happens in the Agent Designer's Capabilities section, by picking a skill name as
// `implementedBy`). What this screen shows instead is which *published* agents already
// use a given skill — read-only, derived from live Control Plane data.
export function SkillDesignerScreen() {
  const skills = useSkillsStore((s) => s.skills)
  const selectedId = useSkillsStore((s) => s.selectedId)
  const select = useSkillsStore((s) => s.select)
  const addBlank = useSkillsStore((s) => s.addBlank)
  const addSample = useSkillsStore((s) => s.addSample)
  const remove = useSkillsStore((s) => s.remove)
  const update = useSkillsStore((s) => s.update)
  const save = useSkillsStore((s) => s.save)
  const duplicate = useSkillsStore((s) => s.duplicate)
  const loadFromServer = useSkillsStore((s) => s.loadFromServer)

  const skillAssignments = usePlatformStore((s) => s.skillAssignments)
  const refreshPlatform = usePlatformStore((s) => s.refresh)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<{ tone: string; text: string } | null>(null)

  useEffect(() => {
    void loadFromServer()
    void refreshPlatform()
  }, [loadFromServer, refreshPlatform])

  const selected = skills.find((s) => s.id === selectedId) ?? skills[0]

  const handleSave = async () => {
    if (!selected) return
    setSaveState({ tone: 'info', text: 'Saving…' })
    try {
      await save(selected.id)
      setSaveState({ tone: 'good', text: 'Saved' })
    } catch (e) {
      setSaveState({ tone: 'bad', text: e instanceof Error ? e.message : 'save failed' })
    }
  }

  return (
    <Screen
      title="Skill Designer"
      subtitle="Write a SKILL.md — the Anthropic Agent Skills format the Runtime loads: frontmatter + a system prompt."
      actions={
        <>
          <button onClick={() => addSample()}>Load sample</button>
          <button onClick={() => addBlank()}>+ New skill</button>
        </>
      }
    >
      <div className="skill-layout">
        <div className="skill-list">
          {skills.map((entry) => {
            const assignments = skillAssignments[entry.draft.name] ?? []
            const detailOpen = detailId === entry.id
            return (
              <div
                key={entry.id}
                className={entry.id === selectedId ? 'skill-item on' : 'skill-item'}
                onClick={() => select(entry.id)}
              >
                <div className="skill-item-name mono">{entry.draft.name || '(unnamed)'}</div>
                <div className="skill-item-meta">
                  {entry.draft.version && <span className="dim mono">v{entry.draft.version}</span>}
                  {!entry.persisted && <Badge tone="warn">unsaved</Badge>}
                  {assignments.length > 0 && (
                    <Badge tone="good">
                      {assignments.length} agent{assignments.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="skill-item-actions">
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailId(detailOpen ? null : entry.id)
                    }}
                  >
                    detail
                  </button>
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      void duplicate(entry.id)
                    }}
                  >
                    duplicate
                  </button>
                  {skills.length > 1 && (
                    <button
                      className="link danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        void remove(entry.id)
                      }}
                    >
                      remove
                    </button>
                  )}
                </div>
                {detailOpen && (
                  <div className="skill-item-detail" onClick={(e) => e.stopPropagation()}>
                    {assignments.length === 0 ? (
                      <p className="dim">Not used by any published agent yet.</p>
                    ) : (
                      <ul>
                        {assignments.map((a, i) => (
                          <li key={i} className="mono">{a.name}@{a.version}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {selected && (
          <>
            <div className="agent-editor">
              <SkillDesigner draft={selected.draft} onChange={(next) => update(selected.id, next)} />
            </div>
            <div className="agent-preview">
              <div className="preview-collapse-row">
                {saveState && <span className={`publish-note ${saveState.tone}`}>{saveState.text}</span>}
                <button className="primary" onClick={handleSave}>Save</button>
              </div>
              <SkillPreview draft={selected.draft} />
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
