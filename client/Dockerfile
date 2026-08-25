# syntax=docker/dockerfile:1

# Production image for the DevPulse client.
#
# The client is a Vite SPA, so the build output is static files - the final
# image needs a web server, not a Node runtime. Discarding Node after the build
# stage is what keeps this image an order of magnitude smaller than the builder.

# ---------------------------------------------------------------------------
# Stage 1 - build the static bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# See server/Dockerfile: npm 10 cannot resolve this lockfile's eslint peer range.
RUN npm install -g npm@11.12.1

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 - serve
# ---------------------------------------------------------------------------
# nginx-unprivileged runs as a non-root user on an unprivileged port out of the
# box; the stock nginx image needs its pid file and cache directories rewritten
# to achieve the same thing.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
