# Gargantua Studio

The control center of the **Gargantua AI Operating System** — design, test, launch and
monitor AI agents. This is **one deployable**: the React SPA (frontend) and the Spring Boot
BFF (backend) live in this single repo and ship as **one Docker image** — Spring serves the
UI at `/` and the API at `/api` on the same origin (no separate nginx).

> Previously split across `gargantua-studio` + `gargantua-studio-backend`; merged 2026-08.

## Layout

```
frontend/            React 18 + Vite + TypeScript SPA (Agent/Skill Designer, Playground, Trace…)
  src/ …
pom.xml, src/        Spring Boot 4.1 / Java 25 BFF: builds gargantua.ai/v1 manifests
                     against the shared agent-core model, gateways the Control Plane,
                     and runs the Launch command (/api/studio/launch)
Dockerfile           multi-stage: build SPA → bake into Spring static → one JRE image
```

The BFF owns manifest/skill building (against `agent-core`), publishing to the Control
Plane, and launching a Runtime. The SPA is a thin client over `/api/studio/*`.

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

`runtime_src` (the sibling `gargantua` Runtime repo) supplies `agent-core`, built from
source — no Maven Central release needed. Normally you build it via
[`gargantua-compose`](../gargantua-compose) (the `studio` service), which wires it to the
Control Plane, Postgres, and Docker access for the Launch button.

## Test

```bash
mvn test                     # backend (manifest/skill builders, API)
cd frontend && npm run build # frontend type-check + bundle
```
