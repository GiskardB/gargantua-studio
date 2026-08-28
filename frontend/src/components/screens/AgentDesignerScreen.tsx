import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AgentDesigner } from '../AgentDesigner'
import { AgentGraph } from '../AgentGraph'
import { ManifestPreview } from '../ManifestPreview'
import { PublishDialog } from '../PublishDialog'
import { Screen, Badge } from '../ui'
import { useDraftStore } from '../../store/draftStore'
import { useSkillsStore } from '../../store/skillsStore'
import { usePlatformStore } from '../../store/platformStore'
import { getWorkloadDraft, downloadBundle, skillsForDraft } from '../../lib/api'
import { useManifestBuild, usePublish } from '../../lib/useManifestPreview'
import { emptyDraft } from '../../types/draft'

type Tab = 'form' | 'graph'

// The one real, functional designer: it produces a live gargantua.ai/v1 manifest,
// built and validated by the backend against the shared model. The draft lives in a
// Zustand store, so the form, the graph view and the preview all share one source.
export function AgentDesignerScreen() {
  const draft = useDraftStore((s) => s.draft)
  const setDraft = useDraftStore((s) => s.setDraft)
  const loadSample = useDraftStore((s) => s.loadSample)
  const clear = useDraftStore((s) => s.clear)

  // `?workload=name:version` in the URL, read reactively so re-entering this screen via
  // the nav rail (a client-side route change, not a reload) correctly drops back to the
  // landing state instead of getting stuck showing a stale editing session.
  const [searchParams, setSearchParams] = useSearchParams()
  const editingWorkload = searchParams.get('workload')

  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('form')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [bundleError, setBundleError] = useState<string | null>(null)
  const [downloadingBundle, setDownloadingBundle] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  const { yaml, errors, source, valid } = useManifestBuild(draft)
  const { publishState, published, publish } = usePublish(draft, yaml)
  const skills = useSkillsStore((s) => s.skills)
  // Publishing needs the Control Plane (Studio itself only persists drafts + skills
  // in Postgres, then pushes the bundle to CP). When CP is down or a developer is
  // working against their own variant, publish is disabled and Download bundle stays
  // enabled — so Studio is still fully usable standalone.
  const cpOnline = usePlatformStore((s) => s.cpOnline)

  // Independent of the Control Plane — this only needs the Studio backend, so it works
  // (and is worth having) even with no other Gargantua service running.
  const downloadAsZip = async () => {
    setBundleError(null)
    setDownloadingBundle(true)
    try {
      const referenced = skillsForDraft(draft, skills.map((e) => e.draft))
      const { blob, filename } = await downloadBundle(draft, referenced)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setBundleError(e instanceof Error ? e.message : 'download failed')
    } finally {
      setDownloadingBundle(false)
    }
  }

  // So the Capabilities section's "implementedBy" suggestions are populated even if
  // this is the first screen visited this session (Skill Designer loads the same store).
  const loadSkills = useSkillsStore((s) => s.loadFromServer)
  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

  // Fetch the real published manifest and hydrate the form — this is what makes
  // "click a workload to edit it" show actual Control Plane data instead of an empty form.
  useEffect(() => {
    if (!editingWorkload) return
    const sep = editingWorkload.lastIndexOf(':')
    if (sep <= 0) return
    const name = editingWorkload.slice(0, sep)
    const version = editingWorkload.slice(sep + 1)
    let cancelled = false
    setLoadState('loading')
    getWorkloadDraft(name, version)
      .then((fetched) => {
        if (cancelled) return
        setDraft(fetched)
        setLoadState('idle')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadState('error')
        setLoadError(err instanceof Error ? err.message : 'failed to load workload')
      })
    return () => {
      cancelled = true
    }
  }, [editingWorkload, setDraft])

  // Warn on an actual tab close/reload while a draft is being authored — losing an
  // in-progress agent to a stray Ctrl+W is the failure mode this guards against.
  const isEditing = formOpen || !!editingWorkload
  useEffect(() => {
    if (!isEditing) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isEditing])

  const startNew = () => {
    setSearchParams({})
    // Prefilled so the form doesn't open already showing "metadata.name is required" —
    // the placeholder is meant to be overwritten, not a real default.
    setDraft({
      ...emptyDraft(),
      metadata: { ...emptyDraft().metadata, name: 'new-agent', version: '0.1.0' },
    })
    setFormOpen(true)
  }

  const startSample = () => {
    setSearchParams({})
    loadSample()
    setFormOpen(true)
  }

  const clearAll = () => {
    setSearchParams({})
    clear()
    setFormOpen(false)
  }

  // Landing state: no form open, no editing workload
  if (!formOpen && !editingWorkload) {
    return (
      <Screen
        title="Agent Designer"
        subtitle="Author an agent declaratively — the output is a valid gargantua.ai/v1 manifest."
        actions={
          <>
            <button className="primary" onClick={startNew}>+ New Agent</button>
            <button onClick={startSample} style={{ marginLeft: 8 }}>
              Load sample
            </button>
          </>
        }
      >
        <div className="agent-split">
          <div className="agent-editor">
            <div className="welcome-state">
              <div className="welcome-icon">▰▰</div>
              <h2>Create your first agent</h2>
              <p>Start from scratch or load a sample to see how it works.</p>
              <div className="welcome-actions">
                <button className="primary" onClick={startNew}>+ New Agent</button>
                <button onClick={startSample} style={{ marginLeft: 12 }}>
                  Load sample
                </button>
              </div>
              <div className="welcome-hint">
                <p>Or go to <strong>Workload Designer</strong> to see published agents and click one to edit it.</p>
              </div>
            </div>
          </div>
          <div className="agent-preview">
            <ManifestPreview
              yaml={yaml}
              errors={errors}
              source={source}
              filename={`${draft.metadata.name || 'agent'}-manifest.yaml`}
              publishState={publishState}
              published={published}
            />
          </div>
        </div>
      </Screen>
    )
  }

  // Form open (new, sample, or editing existing)
  return (
    <Screen
      title={editingWorkload ? `Editing: ${editingWorkload}` : 'Agent Designer'}
      subtitle="Author an agent declaratively — the output is a valid gargantua.ai/v1 manifest."
      actions={
        <>
          <div className="tabs">
            <button className={tab === 'form' ? 'tab on' : 'tab'} onClick={() => setTab('form')}>
              Form
            </button>
            <button className={tab === 'graph' ? 'tab on' : 'tab'} onClick={() => setTab('graph')}>
              Graph
            </button>
          </div>
          <button onClick={clearAll}>Clear</button>
          <button
            onClick={downloadAsZip}
            disabled={!valid || source !== 'backend' || downloadingBundle}
            title="Download the .gbundle zip locally — no Control Plane needed"
          >
            {downloadingBundle ? 'Building…' : 'Download bundle'}
          </button>
          <button
            className="primary"
            onClick={() => setShowPublishDialog(true)}
            disabled={!valid || source !== 'backend' || !cpOnline}
            title={
              source !== 'backend'
                ? 'Publishing needs the Studio backend online'
                : !cpOnline
                  ? 'Control Plane is unreachable — try again once it is up'
                  : 'Publish to the Control Plane'
            }
          >
            Save &amp; Publish
          </button>
        </>
      }
    >
      {bundleError && (
        <div style={{ marginBottom: 12 }}>
          <Badge tone="bad">Bundle download failed: {bundleError}</Badge>
        </div>
      )}
      {editingWorkload && (
        <div style={{ marginBottom: 12 }}>
          {loadState === 'loading' && <Badge tone="neutral">Loading {editingWorkload} from Control Plane…</Badge>}
          {loadState === 'error' && (
            <Badge tone="bad">Couldn't load {editingWorkload}: {loadError}</Badge>
          )}
          {loadState === 'idle' && <Badge tone="good">Editing: {editingWorkload} (loaded from Control Plane)</Badge>}
        </div>
      )}
      <div className={previewCollapsed ? 'agent-split preview-collapsed' : 'agent-split'}>
        <div className="agent-editor">
          {tab === 'form' ? (
            <AgentDesigner draft={draft} onChange={setDraft} />
          ) : (
            <AgentGraph draft={draft} onDraftChange={setDraft} />
          )}
        </div>
        {previewCollapsed ? (
          <div className="preview-collapsed-rail">
            <button
              className="preview-collapse-toggle"
              onClick={() => setPreviewCollapsed(false)}
              title="Show manifest.yaml"
            >
              manifest.yaml »
            </button>
          </div>
        ) : (
          <div className="agent-preview">
            <div className="preview-collapse-row">
              <button className="link" onClick={() => setPreviewCollapsed(true)} title="Hide manifest.yaml">
                collapse »
              </button>
            </div>
            <ManifestPreview
              yaml={yaml}
              errors={errors}
              source={source}
              filename={`${draft.metadata.name || 'agent'}-manifest.yaml`}
              publishState={publishState}
              published={published}
            />
          </div>
        )}
      </div>
      {showPublishDialog && (
        <PublishDialog
          open={showPublishDialog}
          title={draft.metadata.name || 'agent'}
          version={draft.metadata.version || '0.0.0'}
          onPublish={async () => {
            setShowPublishDialog(false)
            await publish()
          }}
          onCancel={() => setShowPublishDialog(false)}
        />
      )}
    </Screen>
  )
}
