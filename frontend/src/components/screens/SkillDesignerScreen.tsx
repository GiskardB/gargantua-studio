import { SkillDesigner } from '../SkillDesigner'
import { SkillPreview } from '../SkillPreview'
import { Screen, Badge } from '../ui'
import { useSkillsStore } from '../../store/skillsStore'
import { useDraftStore } from '../../store/draftStore'

// Skills are bundle content (SKILL.md), not manifest fields — authoring one here never
// publishes anything. "Assign to agent" is the bridge to the Agent Designer: it upserts
// a Capability on the current draft with implementedBy = this skill's name, so the
// agent's advertised capabilities stay derived from the skills you've actually written.
export function SkillDesignerScreen() {
  const skills = useSkillsStore((s) => s.skills)
  const selectedId = useSkillsStore((s) => s.selectedId)
  const select = useSkillsStore((s) => s.select)
  const addBlank = useSkillsStore((s) => s.addBlank)
  const addSample = useSkillsStore((s) => s.addSample)
  const remove = useSkillsStore((s) => s.remove)
  const update = useSkillsStore((s) => s.update)
  const assignSkillAsCapability = useDraftStore((s) => s.assignSkillAsCapability)
  const agentCapabilities = useDraftStore((s) => s.draft.capabilities)

  const selected = skills.find((s) => s.id === selectedId) ?? skills[0]

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
            const assigned = agentCapabilities.some((c) => c.implementedBy === entry.draft.name)
            return (
              <div
                key={entry.id}
                className={entry.id === selectedId ? 'skill-item on' : 'skill-item'}
                onClick={() => select(entry.id)}
              >
                <div className="skill-item-name mono">{entry.draft.name || '(unnamed)'}</div>
                <div className="skill-item-meta">
                  {entry.draft.version && <span className="dim mono">v{entry.draft.version}</span>}
                  {assigned && <Badge tone="good">assigned</Badge>}
                </div>
                {skills.length > 1 && (
                  <button
                    className="link danger skill-item-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(entry.id)
                    }}
                  >
                    remove
                  </button>
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
              <SkillPreview draft={selected.draft} onAssign={() => assignSkillAsCapability(selected.draft)} />
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
