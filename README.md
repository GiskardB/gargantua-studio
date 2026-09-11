# Gargantua Studio

[![License](https://img.shields.io/github/license/GiskardB/gargantua-studio?style=flat-square&color=blue)](LICENSE)
[![Java](https://img.shields.io/badge/Java-25-007396?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/25/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**The visual front end for the Gargantua platform** — design an agent's manifest and
skills without hand-writing YAML, publish it to a [Control Plane](../gargantua-control-plane),
launch it, and talk to it, all from a browser.

> **Optional, not required.** [Gargantua](../gargantua) is a complete platform on its own
> — a hand-written `manifest.yaml` + `SKILL.md` is enough to run an agent. Studio exists
> for the case where you'd rather point-and-click than hand-edit YAML, or you're managing
> several agents against a shared Control Plane instead of one.

Ships as **one Docker image**: the React SPA and the Spring Boot BFF live in this single
repo, and Spring serves the UI at `/` and the API at `/api` on the same origin — no
separate nginx, no CORS to configure.

> Previously split across `gargantua-studio` + `gargantua-studio-backend`; merged into
> this one repo/image in 2026-08.

## Try it in 60 seconds

The fastest path is [`gargantua-compose`](../gargantua-compose), which wires Studio to a
Control Plane, Postgres, and Docker access in one command:

```bash
git clone http://forgejo:3000/gbrescia/gargantua-compose.git   # or the GitHub mirror
cd gargantua-compose && cp .env.example .env
DOCKER_BUILDKIT=1 docker compose up -d --build --wait
```

Open `http://localhost:18081` — see [`gargantua-compose`](../gargantua-compose)'s README
for the full picture and other services in the stack.

## What it does

Ten screens, grouped by what stage of an agent's life they cover. Most are wired to a
real backend; a few are UI previews of platform capability that doesn't have a serving
system behind it yet — that split is marked explicitly below rather than left to guesswork.

| Screen | Group | Backend |
|---|---|---|
| **Agent Designer** | Design | Live — builds/validates a `gargantua.ai/v1` manifest against `agent-core`, including PACT Core's `cognition`/`contract`/`interfaces` fields (see [PACT](https://github.com/GiskardB/PACT)) |
| **Skill Designer** | Design | Live — builds/validates a `SKILL.md` (frontmatter + system prompt) |
| **Workload Designer** | Design | Live — lists published workloads and deployments from the Control Plane, deletes them |
| **Playground** | Test | Live — chats with a running agent over its `/api/agent/chat`, streams the reply |
| **Trace Explorer** | Test | Live — reads a running agent's `/api/traces` (per-turn execution events); falls back to sample data if no agent is reachable |
| **Evaluation Studio** | Test | Preview — datasets/benchmark UI for accuracy, latency, cost, hallucination and tool-success comparisons; no evaluation engine behind it yet |
| **Gateway Designer** | Govern | Preview — canary/blue-green routing UI; no gateway service behind it yet (see `gargantua-gateway`, not built) |
| **Security Designer** | Govern | Preview — RBAC/tenants/authorized-clients UI; not wired to the Control Plane's Policy Manager yet |
| **Control Plane Status** | System | Live — deployments and their state, polled from the Control Plane |
| **Settings** | System | Live — a **registry of Control Planes**, not one fixed connection: add one per environment (local, shared dev, a customer's own) and switch which one every publish/launch/read call goes through, with no restart |

Publishing (Agent Designer → **Publish**) sends the manifest and skill bundle to whichever
Control Plane is active in Settings. Launching (Workload Designer → **Launch**) starts one
Docker container per agent with its own port, concurrently, against the Runtime image —
see the security note in `LaunchService`: this is a local-dev/demo capability and the
image should not be exposed publicly.

## Architecture

```
frontend/            React 18 + Vite + TypeScript SPA (screens above), Zustand for state,
  src/                @xyflow/react for the graph editor, Monaco for raw YAML/Markdown
pom.xml, src/        Spring Boot 4.1 / Java 25 BFF: builds gargantua.ai/v1 manifests
                     against the shared agent-core model, gateways the Control Plane,
                     and runs the Launch command (/api/studio/launch)
Dockerfile           multi-stage: build SPA → bake into Spring static → one JRE image
```

The BFF owns manifest/skill building (against `agent-core`, the same domain module the
Runtime and Control Plane use — so Studio, Runtime and Control Plane name the same things
the same way instead of each keeping their own copy), publishing to the Control Plane,
and launching a Runtime. The SPA is a thin client over `/api/studio/*`.

## Develop

```bash
# backend (serves /api on :8090)
mvn spring-boot:run
# frontend (Vite dev server on :5173, proxies /api + /actuator → :8090)
cd frontend && npm install && npm run dev
```

Open the Vite dev URL; API calls are proxied to the backend. In production the image
serves both from `:8090`.

## Build the single image

```bash
docker build --build-context runtime_src=../gargantua -t gargantua-studio .
```

`runtime_src` (the sibling [`gargantua`](../gargantua) Runtime repo) supplies `agent-core`,
built from source — no Maven Central release needed. Normally you build it via
[`gargantua-compose`](../gargantua-compose) (the `studio` service) instead, which wires it
to the Control Plane, Postgres, and Docker access for the Launch button.

## Test

```bash
mvn test                     # backend (manifest/skill builders, API)
cd frontend && npm run build # frontend type-check + bundle
```

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Zustand, `@xyflow/react`, Monaco Editor |
| Backend | Java 25, Spring Boot 4.1 (web, validation, actuator, security) |
| Shared domain model | `agent-core` (Spring-free), built from the `gargantua` Runtime repo |
| Delivery | one multi-stage Dockerfile, one image, one process serving SPA + API |

## Where to next

- [`gargantua`](../gargantua) — the Runtime and Library framework Studio designs agents for
- [`gargantua-control-plane`](../gargantua-control-plane) — Registry/Catalog/Policy/Deployment service Studio publishes to and reads from
- [`gargantua-compose`](../gargantua-compose) — one command to run Studio, Control Plane and Postgres together
- [PACT](https://github.com/GiskardB/PACT) — the open agent-description spec behind the Agent Designer's Cognition/Contract/Interfaces fields
