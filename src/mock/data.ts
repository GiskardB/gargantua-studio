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

export interface CapabilityRow {
  name: string
  version: string
  description: string
  implementedBy: string[]
  tags: string[]
  health: Health
  callsPerDay: number
}

export const CAPABILITIES: CapabilityRow[] = [
  { name: 'refund-payment', version: '1.0.0', description: 'Handles a payment refund request end to end.', implementedBy: ['customer-agent:1.2.0'], tags: ['payments', 'gdpr'], health: 'healthy', callsPerDay: 4210 },
  { name: 'payment-status', version: '1.1.0', description: 'Reports the current status of a payment.', implementedBy: ['customer-agent:1.2.0', 'invoice-summariser:1.1.2'], tags: ['payments'], health: 'healthy', callsPerDay: 9800 },
  { name: 'dispute-transaction', version: '2.0.0', description: 'Opens a fraud dispute for a suspicious charge.', implementedBy: ['fraud-agent:0.9.1'], tags: ['payments', 'fraud'], health: 'degraded', callsPerDay: 1330 },
  { name: 'assess-risk-score', version: '1.0.2', description: 'Returns a 0–100 risk score for a transaction.', implementedBy: ['fraud-agent:0.9.1'], tags: ['fraud', 'ml'], health: 'healthy', callsPerDay: 15600 },
  { name: 'classify-intent', version: '1.0.4', description: 'Maps free text to a routing intent.', implementedBy: ['intent-classifier:1.0.4'], tags: ['nlp', 'routing'], health: 'healthy', callsPerDay: 42000 },
  { name: 'summarise-invoice', version: '1.1.0', description: 'Produces a short summary of an invoice PDF.', implementedBy: ['invoice-summariser:1.1.2'], tags: ['finance', 'rag'], health: 'healthy', callsPerDay: 620 },
]

export const CAPABILITY_SCHEMA_SAMPLE = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "paymentId": { "type": "string", "description": "Payment to refund" },
    "amount":    { "type": "number", "minimum": 0 },
    "reason":    { "type": "string" }
  },
  "required": ["paymentId"]
}`

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
