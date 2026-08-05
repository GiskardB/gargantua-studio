import { stringify } from 'yaml'
import type { AgentManifest } from '../types/manifest'

// Serialize the manifest with the top-level ordering the docs use
// (apiVersion, kind, metadata, spec). The `yaml` library preserves insertion
// order for plain objects, and buildManifest already emits keys in schema
// order, so a straight stringify matches the reference document.
export function toYaml(manifest: AgentManifest): string {
  return stringify(manifest, {
    indent: 2,
    lineWidth: 0, // never fold long lines (e.g. ${secrets.x} URLs)
  })
}
