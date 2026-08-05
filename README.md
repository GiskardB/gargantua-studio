# Gargantua Studio

Control Center della piattaforma **Gargantua AI Operating System**. Punto
unico per progettare, testare e governare workload AI dichiarativamente.
**Lo Studio non esegue direttamente gli agenti** — produce stato desiderato
che il [Control Plane](../gargantua-control-plane) versiona e distribuisce.

> **Stato:** MVP in corso. È implementato l'**Agent Designer** che produce un
> manifest `gargantua.ai/v1` valido. Gli altri designer sono ancora placeholder.

---

## 0. MVP: Agent Designer (implementato)

App **React + Vite + TypeScript**, client-only: genera ed esporta un manifest
`gargantua.ai/v1` interamente nel browser, senza backend (il Control Plane —
Phase 2 — non esiste ancora).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build di produzione in dist/
npm run test       # unit test del builder/validator (vitest)
npm run typecheck
```

Cosa fa:

- Form strutturato su tutte le sezioni della `AgentSpec` — metadata, runtime,
  model, capabilities, MCP servers, memory layers, routing/roles, guardrails.
- **Anteprima YAML live** del manifest a ogni modifica.
- **Validazione** che rispecchia gli invarianti che il Runtime impone nei
  costruttori dei record (`WorkloadMetadata`, `AgentSpec`, `McpServerSpec`,
  `ModelSpec`): nomi obbligatori, unicità di capability e server MCP, transport
  stdio↔command / http-sse↔url, temperature 0–2, maxTokens > 0.
- **Export** del `manifest.yaml` (bloccato finché ci sono errori) — da validare
  poi con `gargantua validate` nella CLI del Runtime.

I campi non ancora enforced a livello di workload nel Runtime (`memoryLayers`,
`allowedRoles`) sono etichettati come tali nell'UI, coerentemente con
`agent-manifest.md`.

### Struttura del codice

| Path | Contenuto |
|---|---|
| `src/types/manifest.ts` | Mirror TS dello schema `gargantua.ai/v1` (allineato 1:1 ai tipi Java di `agent-core`) |
| `src/types/draft.ts` | Modello editabile del form + draft d'esempio |
| `src/lib/buildManifest.ts` | Draft → manifest, omette i campi vuoti |
| `src/lib/validate.ts` | Validazione che rispecchia gli invarianti del Runtime |
| `src/lib/toYaml.ts` | Serializzazione YAML in ordine di schema |
| `src/components/` | Agent Designer, anteprima manifest, primitivi di form |

Il contratto di riferimento è congelato in
[`gargantua/docs/architecture/agent-manifest.md`](../gargantua/docs/architecture/agent-manifest.md)
e [`gargantua/docs/architecture/gargantua-domain-model.md`](../gargantua/docs/architecture/gargantua-domain-model.md).

---

## 1. Ruolo nella piattaforma

```
Utente → Gargantua Studio → Desired State → Control Plane → Runtime
```

Roadmap: **Phase 3** di
[`gargantua/docs/architecture/ai-operating-system.md`](../gargantua/docs/architecture/ai-operating-system.md).

## 2. Cosa dovrà contenere

Sette moduli funzionali, secondo la sezione 5 del documento di visione:

- **Workload Designer** — creazione di Agent, Workflow, AI Service, Evaluator
- **Agent Designer** — Role, Prompt, Skills, Memory, MCP, RAG, Guardrail, Model
- **Capability Designer** — definizione delle capability offerte (nome,
  descrizione, schema input/output), pubblicate poi sulla agent card A2A
- **Playground** — test conversazionali, debugging, tracing
- **Evaluation Studio** — dataset di test, benchmark, confronto versioni,
  scoring automatico (accuracy, latency, costo, hallucination rate, tool
  success rate)
- **Gateway Designer** — esposizione API, A2A, routing, autenticazione, rate
  limit, priorità (configura ciò che [`gargantua-gateway`](../gargantua-gateway)
  applica a runtime)
- **Security Designer** — RBAC, tenant, ruoli, applicazioni autorizzate,
  policy dati, audit

**Nota di design vincolante** (dal documento di visione, §5): la
configurazione del client MCP di un agente si autora qui. Lo Studio produce
le dichiarazioni dei server MCP che finiscono nel manifest del bundle; il
Runtime le consuma e basta — non decide, non valida semanticamente, esegue.

## 3. Architettura

Output primario dello Studio: un **Agent Manifest** (`gargantua.ai/v1`,
forma Kubernetes) più gli asset associati (prompt, skill, policy). Il
Compiler (da costruire, probabilmente come modulo di questo repo o del
Control Plane) trasforma quell'output in un `.gbundle` immutabile e firmato,
secondo il formato già definito lato Runtime in
[`gargantua/agent-bundle`](../gargantua/agent-bundle).

```
Studio (questo repo)
   |  produce Agent Manifest + capability + policy dichiarate
   v
Control Plane — Registry
   |  Compiler genera .gbundle, versione immutabile
   v
Gargantua Runtime
   |  esegue il bundle
   v
Catalog (via A2A) → Gateway → Client
```

## 4. Riferimenti ad altri repository

| Repository | Relazione |
|---|---|
| [`gargantua`](../gargantua) | Definisce il formato manifest/bundle che questo Studio deve produrre. Riferimento: `docs/architecture/agent-manifest.md`, `agent-bundle` (ManifestParser, BundleLoader). |
| [`gargantua-control-plane`](../gargantua-control-plane) | Riceve il bundle pubblicato dallo Studio (Registry) e lo distribuisce (Deployment Manager). |
| [`gargantua-gateway`](../gargantua-gateway) | Consuma la configurazione prodotta dal Gateway Designer (routing, rate limit, auth). |

## 5. Stato

Non avviato. Da fare: modello UI/API per ciascun designer, integrazione con
`agent-skill-linter-maven-plugin` del repo Runtime per validare `SKILL.md` in
fase di authoring, Compiler per la generazione del bundle.
