# Acompanhador de Obras: imagem multi-alvo.
#   --target web  -> nginx servindo o front (React + Vite) e encaminhando /api para a API
#   --target api  -> API Node (Fastify) que fala com o Postgres
# O docker-compose.yml usa os dois alvos + Postgres. Guia: docs/deploy/2026-11-09-coolify.md

# ---------------------------------------------------------------------------
# Build (comum aos dois alvos)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm 9 é o packageManager do repo (package.json da raiz).
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Primeiro só os manifestos, para aproveitar o cache de camadas do install.
# O override de rollup para @rollup/wasm-node (package.json da raiz) funciona também no Linux; mantido.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/api apps/api
RUN pnpm --filter @obras/web build && pnpm --filter @obras/api build
# Só as dependências de produção da API, numa pasta isolada.
RUN pnpm --filter @obras/api deploy --prod /prod/api \
 && cp -r apps/api/dist apps/api/drizzle /prod/api/

# ---------------------------------------------------------------------------
# Alvo api
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 MIGRATIONS_DIR=/app/drizzle MIGRAR_AO_INICIAR=true
COPY --from=build /prod/api /app
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3333/api/saude || exit 1
CMD ["node", "dist/server.js"]

# ---------------------------------------------------------------------------
# Alvo web (último = padrão se ninguém passar --target)
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
