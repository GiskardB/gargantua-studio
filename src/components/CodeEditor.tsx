// Monaco editor wrapper. Light "vs" theme to match the Studio. Used for the live
// manifest YAML, SKILL.md (markdown), and JSON (capability schemas, guardrail settings).
//
// Monaco itself is loaded by @monaco-editor/react's default loader; the surrounding
// app never blocks on it. If Monaco can't load, only this pane shows a spinner — the
// rest of the Studio keeps working.

import Editor from '@monaco-editor/react'

interface Props {
  value: string
  language: 'yaml' | 'json' | 'markdown'
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string | number
}

export function CodeEditor({ value, language, onChange, readOnly, height = '100%' }: Props) {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs"
      loading={<div className="editor-loading">loading editor…</div>}
      onChange={(v) => onChange?.(v ?? '')}
      options={{
        readOnly: !!readOnly,
        minimap: { enabled: false },
        fontSize: 12,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 10, bottom: 10 },
        renderLineHighlight: readOnly ? 'none' : 'line',
        scrollbar: { alwaysConsumeMouseWheel: false },
      }}
    />
  )
}
