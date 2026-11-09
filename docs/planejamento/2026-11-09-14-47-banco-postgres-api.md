# Plano: banco Postgres + API + login real

- **Criado em:** 2026-11-09 14:47
- **Pedido do Otavio:** "cria a estrutura de banco de dados usando postgres e docker, para tornar a aplicação funcional pra mim" (trabalhar com a aplicação e criar obras de verdade).
- **Decisões do Otavio nesta sessão:** login real com e-mail e senha (perfis aplicados também na API); Postgres rodando em Docker.
- **Substitui:** a regra "Sem banco, sem backend" do plano `2026-11-07-mvp-front-mock.md` (Q3). O resto das decisões Q1-Q23 continua valendo.

## Arquitetura

```
navegador ── /api/* ──> apps/api (Fastify, Node 22) ──> Postgres 16 (Docker)
   │                         │
   └── apps/web (Vite)       └── usa @obras/shared (gerarObra, congelarBaseline, aplicarApontamento)
```

- **apps/api**: Fastify + Drizzle ORM + `pg`. Migrations SQL versionadas em `apps/api/drizzle/` (drizzle-kit).
- **Dev:** `docker compose -f docker-compose.dev.yml up -d` sobe só o Postgres (porta 5433 no host, para não brigar com um Postgres local). API em `http://127.0.0.1:3333`; o Vite faz proxy de `/api`.
- **Produção (Coolify):** `docker-compose.yml` com `db` (Postgres + volume), `api` e `web` (nginx serve o front e faz proxy de `/api` para a API). Mesma origem, cookie simples.
- **Senha:** `scrypt` nativo do Node (sem dependência nativa, porque o Windows daqui bloqueia binários `.node`).
- **Sessão:** cookie `sid` httpOnly, SameSite=Lax, Secure em produção; o banco guarda só o hash SHA-256 do token; validade de 30 dias.

## Modelo de dados (normalizado)

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `usuarios` | id, nome, email (único, minúsculo), perfil, senha_hash (null = não loga), ativo, criado_em | perfis diretor / engenheiro / encarregado |
| `sessoes` | id (hash do token), usuario_id, criada_em, expira_em | logout apaga |
| `obras` | id, nome, tipo, endereco, cidade, area_m2, status, data_inicio, orcamento_total, engenheiro_id, encarregado_id, exemplo, revisao, criada_em, atualizada_em | `exemplo = true` nas obras de demonstração; `revisao` para trava otimista |
| `locais` | id, obra_id, nome, tipo, tipo_pavimento, ordem | |
| `etapas_obra` | obra_id + codigo (PK), nome, valor_orcado, valor_estimado | |
| `atividades` | id, obra_id, etapa_codigo, codigo, nome, duracao_confirmada, ordem | |
| `itens_atividade` | id, atividade_id, obra_id, local_id, inicio/fim planejado, inicio/fim real, percentual, valor_orcado | menor unidade medida |
| `baselines` | obra_id + versao (PK), congelada_em, autor_id, justificativa | |
| `baseline_itens` | obra_id, versao, item_id, inicio, fim, valor | |
| `apontamentos` | id, obra_id, item_id, data, percentual_anterior, percentual_novo, observacao, fotos (text[]), autor_id, criado_em | só cresce |
| `modelos` | tipo (PK), dados (jsonb), atualizado_por, atualizado_em | só os modelos editados; sem linha = padrão do código |

Valores em `numeric(14,2)`; datas em `date` (ISO sem fuso, igual ao contrato). IDs em `text`, para manter os IDs que o `gerarObra` já gera.

## API

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/senha` | todos | sessão e troca da própria senha |
| `GET /api/usuarios` | logado | lista (nome e perfil; e-mail só para o diretor) |
| `POST /api/usuarios` · `PATCH /api/usuarios/:id` | diretor | criar, editar, ativar/desativar, redefinir senha |
| `GET /api/obras` | logado | obras visíveis: diretor vê todas; engenheiro e encarregado só as suas |
| `POST /api/obras` | diretor, engenheiro | grava a obra gerada pelo wizard (aceita baseline v1, com autor e data do servidor) |
| `PUT /api/obras/:id` | diretor, engenheiro dono | grava estrutura, datas e valores (com `revisao`; 409 se outra pessoa salvou antes). Ignora baselines e apontamentos do corpo |
| `POST /api/obras/:id/baselines` | diretor, engenheiro dono | congela nova versão (v2+ exige justificativa) |
| `POST /api/obras/:id/apontamentos` | todos com acesso à obra | o servidor aplica o apontamento (mesma regra do shared) |
| `GET /api/modelos` · `PUT /api/modelos/:tipo` · `DELETE /api/modelos/:tipo` · `DELETE /api/modelos` | ler: todos; editar: diretor, engenheiro | modelos editáveis |
| `POST /api/exemplos` | diretor | apaga só as obras `exemplo = true` e recria as 6 de demonstração |

**Encarregado não recebe R$:** para ele a API devolve os valores reescalados como pesos (o orçamento total vira 100). Os indicadores continuam certos, porque o motor usa só proporções, e nenhum valor em reais sai do servidor. (Decisão minha: esconder só na tela deixava o R$ visível nas ferramentas do navegador.)

## Front

- O store mantém a MESMA interface (`useObras` etc.) para não reescrever as telas. As mudanças são aplicadas na hora na tela e enviadas para a API numa fila por obra, que junta "criar + atualizar" do mesmo clique (caso do wizard). Se der erro, aparece um toast e os dados são recarregados do servidor.
- Tela de **login**, **Topbar** com o usuário logado e "Sair" (o seletor simulado sai) e tela **Usuários** (só diretor).
- "Hoje" vira a data real. O campo continua na Topbar como data de referência de visualização; os apontamentos usam a data do servidor.
- "Restaurar dados de exemplo" passa a mexer só nas obras de exemplo e fica só para o diretor.

## Primeiro acesso

`pnpm db:setup` = migrations + diretor inicial (e-mail e senha do `.env` de `apps/api`; se a senha estiver vazia, é gerada e impressa uma vez) + modelos padrão. As obras de exemplo são opcionais: `pnpm db:exemplos`.

## Fora deste passo (próximos)

- Upload real de fotos (hoje são nomes fake). Opção: volume local ou S3/MinIO.
- Backup do Postgres no Coolify.
- Recuperação de senha por e-mail (hoje o diretor redefine).
- Testes de API automatizados além do roteiro manual.

## Ordem de execução

1. Postgres no Docker + `apps/api` (schema, migrations, seed, rotas). Só arquivos novos, sem conflito com os terminais.
2. Esperar os terminais fecharem as correções da revisão (eles editam o store, a Topbar e as páginas).
3. Integração no front: store com API, login, Topbar, Usuários, proxy do Vite.
4. Docker de produção (api + web + db) e atualização do guia do Coolify.
5. Teste ponta a ponta, typecheck, build e handover.
