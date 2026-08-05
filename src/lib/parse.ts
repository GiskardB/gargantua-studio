// Small parsers turning the designer's free-text fields into structured data.
// Shared by buildManifest (to produce the manifest) and validate (to check it),
// so the two never disagree on how a text field is interpreted.

/** Comma-separated list → trimmed non-empty items. */
export function parseCsv(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Whitespace-separated tokens (used for MCP stdio args). */
export function parseArgs(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
}

/** KEY=VALUE per line → object. Blank lines and lines without '=' are skipped. */
export function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key) out[key] = value
  }
  return out
}

/** Parse a number field that may be blank. Returns undefined if empty. */
export function parseOptionalNumber(text: string): number | undefined {
  const t = text.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isNaN(n) ? undefined : n
}
