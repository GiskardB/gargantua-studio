// Uploads text files into a skill's referenceFiles list. Read client-side via
// FileReader — the Runtime's FilesystemSkillRegistry reads these as UTF-8 text
// (skills/<name>/references/<filename>), so binaries would just come out as garbage
// in the prompt; this only accepts text-ish files.

import { useRef } from 'react'
import type { ReferenceFile } from '../types/skillDraft'

interface Props {
  files: ReferenceFile[]
  onChange: (files: ReferenceFile[]) => void
}

export function ReferenceFileUpload({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = async (fileList: FileList) => {
    const read = await Promise.all(
      Array.from(fileList).map(
        (f) =>
          new Promise<ReferenceFile>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ name: f.name, content: String(reader.result ?? '') })
            reader.onerror = () => reject(reader.error)
            reader.readAsText(f)
          }),
      ),
    )
    // Same filename replaces the previous upload instead of duplicating it.
    const byName = new Map(files.map((f) => [f.name, f]))
    for (const f of read) byName.set(f.name, f)
    onChange([...byName.values()])
  }

  const remove = (name: string) => onChange(files.filter((f) => f.name !== name))

  return (
    <div className="ref-upload">
      {files.length > 0 && (
        <ul className="ref-file-list">
          {files.map((f) => (
            <li key={f.name} className="ref-file-item mono">
              <span>{f.name}</span>
              <span className="dim">{f.content.length.toLocaleString()} chars</span>
              <button className="link danger" onClick={() => remove(f.name)}>remove</button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.txt,.json,.yaml,.yml,.csv,text/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <button className="add" onClick={() => inputRef.current?.click()}>+ Upload reference file</button>
    </div>
  )
}
