# Acompanhador de Obras: front estático (React + Vite) servido por nginx.
# Hoje não há backend: os dados vivem no localStorage de cada navegador (ver docs/deploy/2026-11-09-coolify.md).

# ---------------------------------------------------------------------------
# Estágio 1: build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm 9 é o packageManager do repo (package.json da raiz).
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Primeiro só os manifestos, para aproveitar o cache de camadas do install.
# O override de rollup para @rollup/wasm-node (package.json da raiz) funciona também no Linux; mantido.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Código-fonte e build do front (tsc + vite build -> apps/web/dist).
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN pnpm --filter @obras/web build

# ---------------------------------------------------------------------------
# Estágio 2: nginx servindo o dist
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS final
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
