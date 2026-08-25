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
  /** Dark theme for the manifest preview panel (premium code-editor look). */
  dark?: boolean
}

export function CodeEditor({ value, language, onChange, readOnly, height = '100%', dark }: Props) {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={dark ? 'vs-dark' : 'vs'}
      loading={<div className="editor-loading">loading editor…</div>}
      onChange={(v) => onChange?.(v ?? '')}
      options={{
        readOnly: !!readOnly,
        minimap: { enabled: false },
        fontSize: 12.5,
        fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: readOnly ? 'none' : 'line',
        scrollbar: { alwaysConsumeMouseWheel: false },
      }}
    />
  )
}
