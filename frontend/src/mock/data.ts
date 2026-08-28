// Mocked platform data for the Studio screens.
//
// None of this is wired to a backend — the Control Plane (Phase 2) does not
// exist yet. It exists so the whole UX is navigable and legible: every screen
// shows realistic shapes drawn from the domain model
// (gargantua/docs/architecture/gargantua-domain-model.md).

export type Health = 'healthy' | 'degraded' | 'offline'
export type WorkloadKind = 'AGENT' | 'WORKFLOW' | 'EVALUATOR' | 'CLASSIFIER' | 'SERVICE' | 'BATCH_JOB'
export type DeployState = 'running' | 'canary' | 'draft' | 'stopped'

export interface WorkloadRow {
  name: string
  kind: WorkloadKind
  version: string
  owner: string
  state: DeployState
  health: Health
  capabilities: number
  updated: string
}

export const WORKLOADS: WorkloadRow[] = [
  { name: 'customer-agent', kind: 'AGENT', version: '1.2.0', owner: 'payments-team', state: 'running', health: 'healthy', capabilities: 2, updated: '2h ago' },
  { name: 'fraud-agent', kind: 'AGENT', version: '0.9.1', owner: 'risk-team', state: 'canary', health: 'healthy', capabilities: 3, updated: '20m ago' },
  { name: 'onboarding-flow', kind: 'WORKFLOW', version: '2.0.0', owner: 'growth-team', state: 'running', health: 'degraded', capabilities: 1, updated: '1d ago' },
  { name: 'intent-classifier', kind: 'CLASSIFIER', version: '1.0.4', owner: 'platform', state: 'running', health: 'healthy', capabilities: 1, updated: '5h ago' },
  { name: 'refund-quality-eval', kind: 'EVALUATOR', version: '0.3.0', owner: 'risk-team', state: 'draft', health: 'offline', capabilities: 0, updated: '3d ago' },
  { name: 'invoice-summariser', kind: 'SERVICE', version: '1.1.2', owner: 'finance', state: 'running', health: 'healthy', capabilities: 1, updated: '8h ago' },
  { name: 'nightly-reconcile', kind: 'BATCH_JOB', version: '1.0.0', owner: 'finance', state: 'stopped', health: 'offline', capabilities: 0, updated: '2w ago' },
]

export interface ChatTurn {
  role: 'user' | 'agent'
  text: string
  tool?: { name: string; args: string; result: string; ms: number }
  skill?: string
}

export const PLAYGROUND_CONVERSATION: ChatTurn[] = [
  { role: 'user', text: 'Vorrei un rimborso per il pagamento PAY-88213, mi hanno addebitato due volte.' },
  { role: 'agent', skill: 'intent-router', text: 'Ho capito che vuoi aprire un rimborso. Verifico il pagamento PAY-88213…', tool: { name: 'getPayment', args: '{ "paymentId": "PAY-88213" }', result: '{ "status": "CAPTURED", "amount": 49.9, "duplicateOf": "PAY-88190" }', ms: 180 } },
  { role: 'agent', skill: 'refund-skill', text: 'Confermo: PAY-88213 è un doppio addebito di PAY-88190. Procedo con il rimborso di €49,90.', tool: { name: 'refundPayment', args: '{ "paymentId": "PAY-88213", "amount": 49.9 }', result: '{ "refundId": "RF-40021", "status": "PENDING" }', ms: 240 } },
  { role: 'agent', skill: 'refund-skill', text: 'Fatto ✅ Ho aperto il rimborso RF-40021 per €49,90. Arriverà sul tuo metodo di pagamento entro 3–5 giorni lavorativi. Posso aiutarti con altro?' },
  { role: 'user', text: 'No grazie, perfetto!' },
]

export interface EvalDataset {
  name: string
  cases: number
  updated: string
}

export const EVAL_DATASETS: EvalDataset[] = [
  { name: 'refund-golden-set', cases: 120, updated: '1d ago' },
  { name: 'fraud-edge-cases', cases: 64, updated: '4h ago' },
  { name: 'intent-benchmark', cases: 500, updated: '3d ago' },
]

export interface EvalRun {
  version: string
  accuracy: number // 0..1
  toolSuccess: number // 0..1
  hallucination: number // 0..1 (lower better)
  latencyMs: number
  costUsd: number // per 1k calls
  when: string
}

export const EVAL_RUNS: EvalRun[] = [
  { version: 'customer-agent:1.2.0', accuracy: 0.94, toolSuccess: 0.98, hallucination: 0.03, latencyMs: 820, costUsd: 2.1, when: 'today' },
  { version: 'customer-agent:1.1.0', accuracy: 0.91, toolSuccess: 0.95, hallucination: 0.06, latencyMs: 910, costUsd: 2.0, when: '1w ago' },
  { version: 'customer-agent:1.0.0', accuracy: 0.86, toolSuccess: 0.9, hallucination: 0.11, latencyMs: 1200, costUsd: 1.8, when: '1mo ago' },
]

export interface GatewayRoute {
  intent: string
  capability: string
  target: string
  strategy: 'stable' | 'canary 10%' | 'blue/green'
  rateLimit: string
  auth: 'apiKey' | 'oauth2' | 'bearer'
}

export const GATEWAY_ROUTES: GatewayRoute[] = [
  { intent: '"contestare un pagamento"', capability: 'dispute-transaction', target: 'fraud-agent:0.9.1', strategy: 'canary 10%', rateLimit: '60/min', auth: 'oauth2' },
  { intent: '"voglio un rimborso"', capability: 'refund-payment', target: 'customer-agent:1.2.0', strategy: 'stable', rateLimit: '120/min', auth: 'apiKey' },
  { intent: '"stato del pagamento"', capability: 'payment-status', target: 'customer-agent:1.2.0', strategy: 'stable', rateLimit: '300/min', auth: 'apiKey' },
  { intent: '"riassumi questa fattura"', capability: 'summarise-invoice', target: 'invoice-summariser:1.1.2', strategy: 'blue/green', rateLimit: '30/min', auth: 'bearer' },
]

export interface Role {
  name: string
  description: string
  permissions: string[]
  members: number
}

export const ROLES: Role[] = [
  { name: 'super-admin', description: 'Full control over the platform.', permissions: ['workload:*', 'policy:*', 'deploy:*', 'secret:read'], members: 3 },
  { name: 'support-agent', description: 'Invokes customer-facing capabilities.', permissions: ['capability:refund-payment', 'capability:payment-status'], members: 42 },
  { name: 'risk-analyst', description: 'Fraud tooling and dispute review.', permissions: ['capability:dispute-transaction', 'capability:assess-risk-score', 'eval:read'], members: 11 },
  { name: 'auditor', description: 'Read-only access to audit and cost.', permissions: ['audit:read', 'cost:read', 'workload:read'], members: 6 },
]

export interface AppClient {
  name: string
  clientId: string
  roles: string[]
  status: 'active' | 'revoked'
}

export const APP_CLIENTS: AppClient[] = [
  { name: 'Web Support Console', clientId: 'app_9f2a…', roles: ['support-agent'], status: 'active' },
  { name: 'Mobile Banking', clientId: 'app_71cd…', roles: ['support-agent'], status: 'active' },
  { name: 'Risk Dashboard', clientId: 'app_0b4e…', roles: ['risk-analyst', 'auditor'], status: 'active' },
  { name: 'Legacy CRM', clientId: 'app_33aa…', roles: ['support-agent'], status: 'revoked' },
]

export interface Tenant {
  name: string
  environment: 'prod' | 'staging' | 'dev'
  workloads: number
}

export const TENANTS: Tenant[] = [
  { name: 'acme-bank', environment: 'prod', workloads: 5 },
  { name: 'acme-bank', environment: 'staging', workloads: 7 },
  { name: 'sandbox', environment: 'dev', workloads: 12 },
]

// ---- execution trace (mirrors agent-core core.execution: ExecutionEvent/Trace) --------

export type ExecEventType =
  | 'TURN_STARTED'
  | 'ROUTING_DECIDED'
  | 'SKILL_SELECTED'
  | 'GUARDRAIL_EVALUATED'
  | 'LLM_CALL'
  | 'TOOL_CALLED'
  | 'TOOL_RESULT'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'HANDOFF'
  | 'TURN_COMPLETED'
  | 'ERROR'

export interface ExecEventRow {
  sequence: number
  type: ExecEventType
  phase?: string
  message: string
  attributes?: Record<string, string | number>
  durationMs?: number
  error?: string
}

export interface ExecTrace {
  traceId: string
  agentId: string
  sessionId: string
  events: ExecEventRow[]
}

export const SAMPLE_TRACE: ExecTrace = {
  traceId: 'trace-6f2a9c',
  agentId: 'customer-agent',
  sessionId: 'sess-1183',
  events: [
    { sequence: 0, type: 'TURN_STARTED', message: 'User: "I want a refund for order 5567"' },
    { sequence: 1, type: 'MEMORY_READ', phase: 'main', message: 'Loaded customer-history', attributes: { scope: 'customer-history', hits: 4 }, durationMs: 8 },
    { sequence: 2, type: 'ROUTING_DECIDED', phase: 'routing', message: 'Routed to refund-skill', attributes: { method: 'SEMANTIC', confidence: 0.91 }, durationMs: 42 },
    { sequence: 3, type: 'SKILL_SELECTED', message: 'refund-skill', attributes: { skill: 'refund-skill' } },
    { sequence: 4, type: 'GUARDRAIL_EVALUATED', message: 'pii-input: PASS', attributes: { guardrail: 'pii-input', verdict: 'PASS' }, durationMs: 3 },
    { sequence: 5, type: 'LLM_CALL', phase: 'main', message: 'gpt-4o', attributes: { provider: 'openai', model: 'gpt-4o', inputTokens: 812, outputTokens: 96 }, durationMs: 1240 },
    { sequence: 6, type: 'TOOL_CALLED', message: 'refundPayment(order=5567)', attributes: { server: 'payments-api', tool: 'refundPayment' } },
    { sequence: 7, type: 'TOOL_RESULT', message: 'refund accepted', attributes: { tool: 'refundPayment', status: 'ok', refundId: 'rf_88213' }, durationMs: 380 },
    { sequence: 8, type: 'MEMORY_WRITE', phase: 'main', message: 'Recorded refund in episodic memory', attributes: { layer: 'EPISODIC' }, durationMs: 6 },
    { sequence: 9, type: 'GUARDRAIL_EVALUATED', message: 'max-length: PASS', attributes: { guardrail: 'max-length', verdict: 'PASS' }, durationMs: 1 },
    { sequence: 10, type: 'TURN_COMPLETED', message: 'Refund rf_88213 issued for order 5567.', attributes: { totalTokens: 908 }, durationMs: 1712 },
  ],
}
