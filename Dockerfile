# ============================================================
# Multi-stage Dockerfile for Experience Gift Platform services
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

ARG SERVICE
ARG CACHE_BUST

COPY package.json package-lock.json tsconfig.base.json ./

COPY packages/shared-types/package.json packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/shared-types/src ./packages/shared-types/src

COPY packages/services/${SERVICE}/package.json packages/services/${SERVICE}/tsconfig.json ./packages/services/${SERVICE}/
COPY packages/services/${SERVICE}/src ./packages/services/${SERVICE}/src

RUN npm ci --workspace=packages/shared-types --workspace=packages/services/${SERVICE} --include-workspace-root

RUN npm run build --workspace=packages/shared-types \
 && npm run build --workspace=packages/services/${SERVICE}

FROM node:20-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ARG SERVICE
ENV SERVICE_NAME=${SERVICE}

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/services/${SERVICE}/package.json ./packages/services/${SERVICE}/

RUN npm ci --omit=dev --workspace=packages/shared-types --workspace=packages/services/${SERVICE} --include-workspace-root \
 && npm cache clean --force

COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/services/${SERVICE}/dist ./packages/services/${SERVICE}/dist

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD node packages/services/$SERVICE_NAME/dist/server.js