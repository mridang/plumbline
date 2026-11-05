# syntax=docker/dockerfile:1.7
# The scan server runs webhint's puppeteer connector, which drives a real
# Chromium, so — unlike the sibling `scratch` images — this one ships a Node
# runtime and a system Chromium. Both base layers are multi-arch, so buildx
# produces linux/amd64 and linux/arm64 from the same Dockerfile (arm64 on an
# amd64 runner goes through QEMU; there is no cross-compilation to do).

# --- Builder: install every workspace dependency and compile to dist/ -------
FROM node:24-bookworm-slim AS builder

# puppeteer-core (pulled in by @hint/connector-puppeteer) never downloads a
# browser, but set the flag anyway so an `npm ci` cannot reach out for one.
ENV PUPPETEER_SKIP_DOWNLOAD=1

WORKDIR /app

# Copy the whole monorepo (node_modules and dist are excluded by
# .dockerignore) and install with the workspace sources present, so npm wires
# the `@mridang/*` workspace symlinks exactly as a local `npm ci` does. The
# deep `@mridang/webhint-hint-plumbline/dist/*` imports then resolve once the
# project references are built.
COPY . .
RUN npm ci

# Build every workspace's dist/ with the project references.
RUN npm run build

# Drop dev dependencies so only what the server needs at runtime is carried
# into the final image.
RUN npm prune --omit=dev

# --- Runtime: Node + Chromium + the built server ----------------------------
FROM node:24-bookworm-slim AS runtime

# Chromium and the fonts it needs to render pages. `--no-install-recommends`
# keeps the layer small; the font packages cover Latin, CJK and emoji so the
# scanned page renders the way a user would see it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-cjk \
      fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

# OCI image-spec labels so registries and scanners can trace the image back to
# its source, license and project.
LABEL org.opencontainers.image.source="https://github.com/mridang/plumbline"
LABEL org.opencontainers.image.url="https://github.com/mridang/plumbline"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.title="webhint-scan-server"
LABEL org.opencontainers.image.description="HTTP server that runs the plumbline checks against a URL and returns JSON"

# The release version, injected by the bake `image` target from the git tag so
# the report's `scannerVersion` matches the published image.
ARG SCANNER_VERSION=dev
ENV SCANNER_VERSION=$SCANNER_VERSION

# Point the puppeteer connector at the distro Chromium (puppeteer-core ships no
# browser of its own), and tell the server where to listen.
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages

# `node` is the unprivileged user the base image already provides (uid 1000).
# Chromium runs with --no-sandbox (set in the connector options) because the
# kernel user-namespace sandbox is unavailable to an unprivileged container.
USER node

EXPOSE 8080
ENTRYPOINT ["node", "packages/docker/dist/server.js"]

# --- Scanner: Node + the built server, no browser ----------------------------
# The streaming scan (`POST /run`) runs the checks as a webhint-free engine in
# Node (see packages/cli/src/engine), so it needs no Chromium: the page is
# fetched with Node itself, and the TLS checks use Node's `tls` and the
# `openssl` program, so the image carries the `openssl` binary. This is the
# image the Cloudflare container runs. It is stated before `runtime` so a plain
# `docker build .` still builds `runtime`, the last stage.
FROM node:24-bookworm-slim AS scanner

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.source="https://github.com/mridang/plumbline"
LABEL org.opencontainers.image.url="https://github.com/mridang/plumbline"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.title="plumbline-scanner"
LABEL org.opencontainers.image.description="HTTP server that streams the plumbline checks of a URL as JSON lines, without a browser"

ARG SCANNER_VERSION=dev
ENV SCANNER_VERSION=$SCANNER_VERSION
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages

USER node

EXPOSE 8080
ENTRYPOINT ["node", "packages/docker/dist/server.js"]
