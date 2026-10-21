FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS build
COPY backend backend
RUN pnpm --filter backend build

FROM build AS images
RUN pnpm --filter backend images

FROM build AS prod-deps
RUN pnpm --filter backend deploy --prod /deploy

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /deploy/node_modules node_modules
COPY --from=prod-deps --chown=node:node /deploy/package.json package.json
COPY --from=build --chown=node:node /repo/backend/dist dist
COPY --from=build --chown=node:node /repo/backend/drizzle drizzle
COPY --from=images --chown=node:node /repo/backend/public public
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
