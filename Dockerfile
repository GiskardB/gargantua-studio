# Gargantua Studio (frontend SPA) — build with Vite, serve with nginx.
#
# VITE_STUDIO_API is baked at build time. The default "" means same-origin: the SPA
# calls /api and /actuator on its own host and nginx (see nginx.conf) reverse-proxies
# them to the Studio backend. That keeps it host-agnostic — works whether the browser
# hits localhost or a LAN IP (e.g. Cave's) — with no CORS and no rebuild per host.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_STUDIO_API=""
ENV VITE_STUDIO_API=$VITE_STUDIO_API
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
