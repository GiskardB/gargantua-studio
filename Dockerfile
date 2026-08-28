# Gargantua Studio — ONE image, frontend + backend.
#
# The React SPA is built and baked into the Spring Boot backend's static resources, so a
# single Spring process serves the UI at / and the API at /api on the same origin (no
# separate nginx). agent-core is built FROM SOURCE (stage `agentcore`) so no Maven Central
# release is needed; the Runtime repo is the named build context `runtime_src`
# (compose: additional_contexts: { runtime_src: ../gargantua }).
# Standalone build:
#   docker build --build-context runtime_src=../gargantua -t gargantua-studio .

# 1) Build the SPA.
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build   # → /fe/dist

# 2) Build + install agent-core into a local Maven repo (see note in the studio-backend
#    history: the whole Runtime repo is copied because `mvn -N install` validates the reactor).
FROM maven:3.9-eclipse-temurin-25-alpine AS agentcore
WORKDIR /ac
COPY --from=runtime_src . .
RUN mvn -q -N install && mvn -q -pl agent-core,agent-bundle install -DskipTests

# 3) Build the backend jar, with the SPA baked into its static resources.
FROM maven:3.9-eclipse-temurin-25-alpine AS builder
WORKDIR /build
COPY --from=agentcore /root/.m2/repository/io/github/giskardb /root/.m2/repository/io/github/giskardb
COPY pom.xml .
COPY src src
COPY --from=frontend /fe/dist src/main/resources/static
RUN mvn -q clean package -DskipTests

FROM eclipse-temurin:25-jre-jammy
# curl: healthcheck + debugging.
# docker CLI + compose plugin: /api/studio/launch shells out to Docker to (re)start a
# runtime. It talks to a daemon via DOCKER_HOST (Cave's remote daemon) or a mounted
# /var/run/docker.sock — this image bundles no daemon. Local-dev/demo capability (see
# LaunchService's security note); do not expose this backend publicly.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu jammy stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*
# Runs as root so it can reach a bind-mounted docker.sock regardless of its host gid.
# Acceptable for this local-dev launcher image; not a general-purpose posture.
WORKDIR /app
COPY --from=builder /build/target/*.jar app.jar
# SPRING_PROFILES_ACTIVE=postgres and GARGANTUA_CONTROL_PLANE_BASE_URL come from Compose.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseG1GC"
EXPOSE 8090
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
