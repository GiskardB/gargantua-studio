import { describe, it, expect } from 'vitest'
import { buildManifest } from './buildManifest'
import { toYaml } from './toYaml'
import { validateDraft, errorCount } from './validate'
import { emptyDraft, sampleDraft } from '../types/draft'

describe('buildManifest', () => {
  it('always stamps the current apiVersion and Agent kind', () => {
    const m = buildManifest(emptyDraft())
    expect(m.apiVersion).toBe('gargantua.ai/v1')
    expect(m.kind).toBe('Agent')
  })

  it('omits empty optional sections rather than emitting null/{}', () => {
    const d = emptyDraft()
    d.metadata.name = 'a'
    d.metadata.version = '1.0.0'
    const m = buildManifest(d)
    expect(m.spec.runtime).toBeUndefined()
    expect(m.spec.model).toBeUndefined()
    expect(m.spec.mcp).toBeUndefined()
    expect(m.spec.capabilities).toBeUndefined()
    expect(m.spec.guardrails).toBeUndefined()
    // metadata carries only what was set
    expect(m.metadata).toEqual({ name: 'a', version: '1.0.0' })
  })

  it('parses text fields into structured manifest values', () => {
    const m = buildManifest(sampleDraft())
    expect(m.metadata.labels).toEqual({ env: 'prod', tier: 'critical' })
    expect(m.spec.model?.temperature).toBe(0.7)
    expect(m.spec.model?.maxTokens).toBe(1000)
    expect(m.spec.memoryLayers).toEqual(['WORKING', 'EPISODIC'])
    expect(m.spec.allowedRoles).toEqual(['support-agent', 'super-admin'])

    const payments = m.spec.mcp?.servers.find((s) => s.name === 'payments-api')
    expect(payments?.transport).toBe('http')
    expect(payments?.auth).toEqual({ type: 'bearer', value: '${secrets.payments-api-token}' })
    expect(payments?.allowedTools).toEqual(['getPayment', 'refundPayment'])

    const github = m.spec.mcp?.servers.find((s) => s.name === 'github')
    expect(github?.transport).toBe('stdio')
    expect(github?.args).toEqual(['-y', '@modelcontextprotocol/server-github'])
    expect(github?.env).toEqual({ GITHUB_TOKEN: '${secrets.github-token}' })
    // stdio server must not carry a url; http server must not carry a command
    expect(github?.url).toBeUndefined()
    expect(payments?.command).toBeUndefined()

    expect(m.spec.guardrails).toEqual({
      'pii-input': { enabled: true },
      'max-length': { maxChars: 8000 },
    })

    // Loadout: knowledge bases are first-class with retrieval overrides; empty
    // overrides are omitted so the runtime inherits the skill defaults.
    expect(m.spec.loadout?.knowledge).toEqual([
      { name: 'payments-kb', description: 'Payment policies and refund rules', maxResults: 8, minScore: 0.55 },
      { name: 'refunds-kb' },
    ])
    expect(m.spec.loadout?.memoryScopes).toEqual(['customer-history'])
    expect(m.spec.loadout?.skills).toEqual(['refund-skill', 'status-skill'])
    expect(m.spec.loadout?.resources).toEqual([
      { name: 'refund-form', type: 'file', uri: 'resources/refund.pdf' },
    ])

    // Governance nests under metadata; visibility is only emitted when it leaves 'private'.
    expect(m.metadata.governance).toEqual({
      tenant: 'payments',
      visibility: 'internal',
      status: 'active',
      access: ['support-agent', 'super-admin'],
    })
  })

  it('serializes to YAML in schema order with secret placeholders intact', () => {
    const yaml = toYaml(buildManifest(sampleDraft()))
    expect(yaml.startsWith('apiVersion: gargantua.ai/v1\n')).toBe(true)
    expect(yaml).toContain('kind: Agent')
    expect(yaml).toContain('${secrets.payments-api-token}')
    expect(yaml).not.toContain('null')
  })
})

describe('validateDraft', () => {
  it('flags a blank draft for the required identity fields', () => {
    const issues = validateDraft(emptyDraft())
    expect(issues.some((i) => i.path === 'metadata.name')).toBe(true)
    expect(issues.some((i) => i.path === 'metadata.version')).toBe(true)
  })

  it('passes the sample draft with no errors', () => {
    expect(errorCount(validateDraft(sampleDraft()))).toBe(0)
  })

  it('mirrors the Runtime invariants: uniqueness, transport, ranges', () => {
    const d = sampleDraft()
    d.capabilities[1].name = 'refund-payment' // duplicate
    d.mcpServers[0].url = '' // http server without url
    d.model.temperature = '3' // out of range
    const issues = validateDraft(d)
    expect(issues.some((i) => i.message.includes('Duplicate capability'))).toBe(true)
    expect(issues.some((i) => i.path === 'mcp.servers[0].url')).toBe(true)
    expect(issues.some((i) => i.path === 'model.temperature')).toBe(true)
  })

  it('rejects unparseable guardrail JSON', () => {
    const d = sampleDraft()
    d.guardrails[0].settingsJson = '{ not json'
    expect(validateDraft(d).some((i) => i.path === 'guardrails[0].settings')).toBe(true)
  })
})
