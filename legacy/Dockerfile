FROM node:12.22.12-bullseye-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS test
RUN sed -i -e 's|deb.debian.org|archive.debian.org|g' -e 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list \
  && apt-get -o Acquire::Check-Valid-Until=false update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium
COPY . .
CMD ["npm", "run", "test:ci"]

FROM test AS mutation
RUN apt-get -o Acquire::Check-Valid-Until=false update \
  && apt-get install -y --no-install-recommends procps \
  && rm -rf /var/lib/apt/lists/*
CMD ["npx", "stryker", "run"]

FROM deps AS build
COPY . .
RUN npm run build:ssr

FROM node:12.22.12-bullseye-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist dist
ENV PORT=4000
USER node
EXPOSE 4000
CMD ["node", "dist/legacy/server/main.js"]
