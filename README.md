# Gargantua Studio

Control Center della piattaforma **Gargantua AI Operating System**. Punto
unico per progettare, testare e governare workload AI dichiarativamente.
**Lo Studio non esegue direttamente gli agenti** — produce stato desiderato
che il [Control Plane](../gargantua-control-plane) versiona e distribuisce.

> Repository non ancora avviato al livello di implementazione. Questo documento
> ne fissa lo scope prima di scrivere la prima riga di codice.

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
