# apps/api

API do Acompanhador de Obras: Node 22 + Fastify + Drizzle ORM + Postgres 16.
Plano: `docs/planejamento/2026-11-09-14-47-banco-postgres-api.md`. Deploy: `docs/deploy/2026-11-09-coolify.md`.

## Rodar em desenvolvimento

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres em 127.0.0.1:5433 (na raiz do repo)
cp apps/api/.env.example apps/api/.env           # só na primeira vez
pnpm db:setup                                    # migrations + diretor inicial (imprime a senha se ADMIN_SENHA vazio)
pnpm db:exemplos                                 # opcional: 6 obras de demonstração
pnpm dev:api                                     # API em http://127.0.0.1:3333
pnpm dev                                         # front em http://127.0.0.1:5180 (proxy de /api para a 3333)
```

## Scripts (dentro de apps/api)

| Script | O que faz |
| --- | --- |
| `pnpm db:gerar --name <nome>` | Gera migration SQL a partir de `src/db/schema.ts` (commite a pasta `drizzle/`). |
| `pnpm db:migrar` | Aplica as migrations pendentes. |
| `pnpm db:setup` | Migrations + diretor inicial se ainda não houver usuário com login. |
| `pnpm db:exemplos` | Apaga só as obras de exemplo e recria as 6. |
| `pnpm usuario:criar -- --email x@y.com --perfil diretor` | Cria usuário ou redefine a senha (imprime a senha gerada). |
| `pnpm build` | Empacota em `dist/` para produção. |

## Regras importantes

- Avanço (%) só muda por apontamento (`POST /api/obras/:id/apontamentos`). O `PUT` da obra preserva o avanço do banco.
- `PUT /api/obras/:id` usa a `revisao` como trava: se outra pessoa salvou antes, responde 409.
- Encarregado nunca recebe R$: os valores vão reescalados como pesos (orçamento total = 100).
- Obras e usuários de exemplo têm `exemplo = true`; "Recriar exemplos" só mexe nas obras de exemplo.
- Gastos reais (financeiro, plano `2026-11-10-15-37`): `GET/POST /api/obras/:id/gastos`, `PATCH/DELETE /api/gastos/:id`,
  `POST /api/obras/:id/gastos/importar` (revalida no servidor, grava só as linhas válidas com um `importacaoId`) e
  `DELETE /api/importacoes/:importacaoId` (desfaz o lote). Quem enxerga a obra pode tudo. Migration `0002_gastos`.
- `OCULTAR_VALORES_ENCARREGADO` (shared) está `false`: o encarregado recebe R$. Se religar, a obra volta reescalada
  (gastos inclusive) e as rotas de gastos respondem 403 para o encarregado.
- E2E dos gastos (cria usuários e obra, use um banco de teste): `E2E_API=... E2E_EMAIL=... E2E_SENHA=... pnpm exec tsx src/scripts/e2e-gastos.ts`.
  Conferência dos gastos de exemplo sem banco: `pnpm exec tsx src/scripts/conferir-gastos-exemplo.ts`.
