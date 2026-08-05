import type { AgentDraft } from '../../types/draft'
import { emptyDraft, sampleDraft } from '../../types/draft'
import { AgentDesigner } from '../AgentDesigner'
import { ManifestPreview } from '../ManifestPreview'
import { Screen } from '../ui'

interface Props {
  draft: AgentDraft
  onChange: (next: AgentDraft) => void
}

// The one real, functional designer: it produces a live gargantua.ai/v1 manifest.
// Editor on the left, manifest preview pinned on the right.
export function AgentDesignerScreen({ draft, onChange }: Props) {
  return (
    <Screen
      title="Agent Designer"
      subtitle="Author an agent declaratively — the output is a valid gargantua.ai/v1 manifest."
      actions={
        <>
          <button onClick={() => onChange(sampleDraft())}>Load sample</button>
          <button onClick={() => onChange(emptyDraft())}>Clear</button>
        </>
      }
    >
      <div className="agent-split">
        <div className="agent-editor">
          <AgentDesigner draft={draft} onChange={onChange} />
        </div>
        <div className="agent-preview">
          <ManifestPreview draft={draft} />
        </div>
      </div>
    </Screen>
  )
}
