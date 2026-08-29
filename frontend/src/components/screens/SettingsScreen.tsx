// Settings: the Control Planes this Studio can talk to. Not a single fixed connection —
// add as many as you like (one per deploy environment: a local one, a shared dev one, a
// customer's own) and pick which one every publish/launch/read call goes through right
// now. Switching takes effect immediately server-side, no restart.

import { useEffect, useState } from 'react'
import { Screen, Panel, Badge } from '../ui'
import { TextInput } from '../fields'
import {
  listControlPlanes,
  createControlPlane,
  updateControlPlane,
  deleteControlPlane,
  activateControlPlane,
  deactivateControlPlane,
  type ControlPlaneConfig,
} from '../../lib/api'
import { usePlatformStore } from '../../store/platformStore'

export function SettingsScreen() {
  const [configs, setConfigs] = useState<ControlPlaneConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const refreshPlatform = usePlatformStore((s) => s.refresh)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setConfigs(await listControlPlanes())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load Control Plane connections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const withBusy = async (id: string, action: () => Promise<void>) => {
    setBusy(id)
    setError(null)
    try {
      await action()
      await load()
      await refreshPlatform()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'action failed')
    } finally {
      setBusy(null)
    }
  }

  const addConfig = () => {
    if (!newName.trim() || !newUrl.trim()) return
    void withBusy('new', async () => {
      await createControlPlane(newName.trim(), newUrl.trim())
      setNewName('')
      setNewUrl('')
    })
  }

  const startEdit = (c: ControlPlaneConfig) => {
    setEditingId(c.id)
    setEditName(c.name)
    setEditUrl(c.baseUrl)
  }

  const saveEdit = () => {
    if (!editingId) return
    const id = editingId
    void withBusy(id, async () => {
      await updateControlPlane(id, editName.trim(), editUrl.trim())
      setEditingId(null)
    })
  }

  const activeConfig = configs.find((c) => c.active)

  return (
    <Screen
      title="Settings"
      subtitle="Control Planes this Studio can publish to and launch against. Add one per deploy environment, then pick which is connected."
      actions={
        activeConfig ? (
          <Badge tone="good">connected: {activeConfig.name}</Badge>
        ) : (
          <Badge tone="neutral">not connected</Badge>
        )
      }
    >
      {error && <div className="empty" style={{ color: 'var(--red)' }}>{error}</div>}
      <Panel title="Control Plane connections">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : (
          <div className="cp-list">
            {configs.length === 0 && <p className="empty">No Control Plane configured yet.</p>}
            {configs.map((c) => (
              <div className="cp-row" key={c.id}>
                {editingId === c.id ? (
                  <>
                    <div className="cp-row-fields">
                      <TextInput value={editName} onChange={setEditName} placeholder="Name" />
                      <TextInput value={editUrl} onChange={setEditUrl} placeholder="http://localhost:8080" mono />
                    </div>
                    <div className="cp-row-actions">
                      <button className="primary" disabled={busy === c.id} onClick={saveEdit}>
                        {busy === c.id ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cp-row-info">
                      <span className="cp-row-name">{c.name}</span>
                      <span className="cp-row-url mono">{c.baseUrl}</span>
                    </div>
                    <div className="cp-row-actions">
                      {c.active ? (
                        <>
                          <Badge tone="good">connected</Badge>
                          <button
                            className="link danger"
                            disabled={busy === c.id}
                            onClick={() => withBusy(c.id, () => deactivateControlPlane())}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button disabled={busy === c.id} onClick={() => withBusy(c.id, () => activateControlPlane(c.id).then(() => {}))}>
                          {busy === c.id ? 'Connecting…' : 'Connect'}
                        </button>
                      )}
                      <button onClick={() => startEdit(c)}>Edit</button>
                      <button
                        className="danger"
                        disabled={busy === c.id}
                        onClick={() => {
                          if (window.confirm(`Remove "${c.name}"? This cannot be undone.`)) {
                            void withBusy(c.id, () => deleteControlPlane(c.id))
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="cp-add">
          <span className="field-label">Add a Control Plane</span>
          <div className="cp-add-row">
            <TextInput value={newName} onChange={setNewName} placeholder="Name (e.g. shared-dev)" />
            <TextInput value={newUrl} onChange={setNewUrl} placeholder="http://localhost:8080" mono />
            <button className="primary" disabled={busy === 'new'} onClick={addConfig}>
              {busy === 'new' ? 'Adding…' : '+ Add'}
            </button>
          </div>
        </div>
      </Panel>
    </Screen>
  )
}
