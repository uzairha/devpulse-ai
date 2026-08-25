# syntax=docker/dockerfile:1

# Production image for the DevPulse API and the BullMQ worker.
#
# Both services run from this single image and differ only in their command:
#   API     -> node src/index.js
#   Worker  -> node src/worker.js
# They share an identical dependency tree, Prisma client and configuration
# module, so a dedicated worker Dockerfile would duplicate every layer here and
# double the build, scan and push cost for no benefit. See docs/aws-deployment.md.

# ---------------------------------------------------------------------------
# Stage 1 - install production dependencies and generate the Prisma client
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Prisma's query engine is dynamically linked against OpenSSL on Alpine.
RUN apk add --no-cache openssl

# node:22-alpine bundles npm 10, whose resolver rejects this lockfile: the repo
# pairs eslint@^9 with @eslint/js@^10, and npm 10 treats that optional peer
# conflict as fatal even under --omit=dev. Pinned to the version the lockfile
# was authored with. See docs/aws-deployment.md for the underlying mismatch.
RUN npm install -g npm@11.12.1

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && npm cache clean --force

# Generate against the production dependency tree so the client that ships is
# the client that was built here.
RUN npx prisma generate

# ---------------------------------------------------------------------------
# Stage 2 - runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# tini reaps zombies and forwards SIGTERM, which ECS sends on task drain; without
# it Node runs as PID 1 and ignores the signal until the 30s kill timeout.
RUN apk add --no-cache openssl tini

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src

# The node:22-alpine image ships an unprivileged "node" user (uid 1000).
USER node

EXPOSE 3001

# Container-level liveness. The ALB and ECS run their own checks against
# /api/health; this one keeps `docker compose` honest locally.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
