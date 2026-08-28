// The editable, form-friendly shape the Skill Designer works with. Field names mirror
// the backend's SkillDraftRequest 1:1, which in turn mirrors the exact SKILL.md
// frontmatter keys the Runtime's SkillMdParser reads — this is the Anthropic Agent
// Skills format (YAML frontmatter + markdown body as the system prompt), authored here
// instead of by hand. A skill is bundle content, not a manifest field: building it does
// not publish anything, unlike the Agent Designer's manifest.

import type { MemoryLayer } from './manifest'

// A text file shipped at skills/<name>/references/<name> in the bundle. The Runtime's
// FilesystemSkillRegistry reads every file in that folder and appends its content to
// the skill's references — the only way to ship supporting docs the frontmatter
// `references:` list (opaque strings) can't carry.
export interface ReferenceFile {
  name: string
  content: string
}

export interface SkillDraft {
  name: string
  description: string
  version: string
  allowedToolsText: string // one per line
  referencesText: string // one per line
  examplesText: string // one per line
  active: boolean
  domain: string
  outputSchema: string
  maxTokens: string
  temperature: string
  preferredModel: string
  knowledgeBase: string
  ragMaxResults: string
  ragMinScore: string
  allowedRolesText: string // comma-separated
  memoryLayers: MemoryLayer[]
  systemPrompt: string
  referenceFiles: ReferenceFile[]
}

export function emptySkillDraft(): SkillDraft {
  return {
    name: '',
    description: '',
    version: '',
    allowedToolsText: '',
    referencesText: '',
    examplesText: '',
    active: true,
    domain: '',
    outputSchema: '',
    maxTokens: '',
    temperature: '',
    preferredModel: '',
    knowledgeBase: '',
    ragMaxResults: '',
    ragMinScore: '',
    allowedRolesText: '',
    memoryLayers: [],
    systemPrompt: '',
    referenceFiles: [],
  }
}

// Mirrors the weather-skill example in docs/skills-and-routing.md, so the designer
// opens with something a new user can read and reshape.
export function sampleSkillDraft(): SkillDraft {
  return {
    name: 'weather-skill',
    description: 'Answers weather-related questions using real-time data from OpenWeatherMap.',
    version: '1.2.0',
    allowedToolsText: 'getWeather\ngetWeatherForecast',
    referencesText: '',
    examplesText: "What's the weather in Rome tomorrow?",
    active: true,
    domain: 'weather',
    outputSchema: 'assets/schema.json',
    maxTokens: '1024',
    temperature: '0.2',
    preferredModel: 'claude-sonnet-4-20250514',
    knowledgeBase: '',
    ragMaxResults: '',
    ragMinScore: '',
    allowedRolesText: '',
    memoryLayers: [],
    systemPrompt:
      'You are a weather assistant. Use the provided tools to answer questions about ' +
      'current conditions and forecasts. Always include the temperature unit in your ' +
      'response. If the user asks about a location you cannot resolve, ask for ' +
      'clarification rather than guessing.\n\n' +
      'Do NOT answer questions unrelated to weather. Politely redirect the user.',
    referenceFiles: [],
  }
}
