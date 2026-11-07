# Handover: kickoff, grill e contratos

- **Criado em:** 2026-11-07 20:04
- **Sessão:** orquestrador (Claude Opus 5.5, terminal Maestro no Maestri)
- **Plano vigente:** `docs/planejamento/2026-11-07-mvp-front-mock.md`

## O que foi feito

1. **Pesquisa (terminal Pesquisador, via portal):** etapas macro/micro, pesos e sequência por tipo de obra → `otavio-vault/projetos/acompanhador-obras/pesquisa/2026-11-07-etapas-por-tipo-de-obra.md`. Espinha dorsal: EAP de 20 itens da Caixa (COT PF v33). Lacunas sem fonte: prédio 3-6 e loja térrea.
2. **Mapa do prya (terminal Escavador, só leitura)** → `otavio-vault/projetos/acompanhador-obras/pesquisa/2026-11-07-mapa-prya-reaproveitamento.md`.
3. **Grill-me:** Q1 a Q23 respondidas e confirmadas pelo Otavio (tabela no plano).
4. **Repo criado** em `C:\Users\Otavi\acompanhador-obras`: monorepo pnpm + turbo, `pnpm install` feito, typecheck verde, git local com 2 commits:
   - `d7a443a` esqueleto + contratos + plano
   - contrato do store com modelos editáveis
5. **Contratos escritos** (os terminais implementam em cima deles):
   - `packages/shared/src/types.ts`: modelo de dados completo
   - `packages/shared/src/calculo.ts`: assinaturas do motor (stubs devolvem zeros)
   - `packages/shared/src/modelos.ts`: EAP, modelos, `gerarObra`, `congelarBaseline` (stubs)
   - `apps/web/src/store/index.tsx`: hooks `useObras`, `useObra`, `useObrasVisiveis`, `podeVerValores` (stub)
6. **App web** com rotas e páginas provisórias: `/`, `/obras`, `/obras/nova`, `/obras/:id`, `/campo`, `/campo/:obraId`, `/modelos`, `/modelos/:tipo`.

## Estado no momento da pausa

- **Briefings NÃO foram entregues aos terminais.** O envio em lote falhou por causa de aspas no shell, antes de sair. Os textos estão salvos em `docs/handover/briefings/` (`comum.txt` vai antes de cada um; `f.txt` = Fundação, `g.txt` = Telas-Gestão, `c.txt` = Telas-Campo).
- **Terminais no canvas** (Opus 5.5, bypass, conectados à nota "Status- Acompanhador de Obras"): Fundação, Telas-Gestão e Telas-Campo estão ociosos; Escavador e Pesquisador terminaram as entregas e seguem abertos.
- **Portais:** "App Obras" (do Otavio), "Portal Gestão" (1440x900), "Portal Campo" (390x844) e "Portal Pesquisador".
- **Dev server:** estava rodando em `http://127.0.0.1:5180`, em background nesta sessão. Se a sessão fechar, ele cai: `cd apps/web && pnpm dev`.
- **Nenhum código de tela ou motor foi implementado ainda**, só os contratos e stubs.

## Próximos passos

1. Subir o dev server se estiver fora (`pnpm dev` na raiz ou em `apps/web`).
2. Se os terminais tiverem sido fechados: recrutar de novo com `--command "claude --model claude-opus-5-5 --permission-mode bypassPermissions" --dir C:/Users/Otavi/acompanhador-obras`, aceitar a tela "trust this folder" (seta pra baixo + Enter via `maestri ask --raw`), conectar na nota e nos portais.
3. Enviar os briefings, montando o JSON com Node a partir dos arquivos (`comum.txt` + `x.txt`), nunca inline no shell.
4. Acompanhar o "STORE NO AR" da Fundação na nota; revisão do Escavador (paridade visual + zero código copiado do prya).
5. Docker / compose / guia Coolify em `docs/deploy/` (só documentação).
6. Build final, handover, `maestri notify`.

## Pendências com o sogro

- 2 ou 3 orçamentos reais da construtora para calibrar pesos e durações (prédio 3-6, loja/galpão, ciclo de laje).
- Confirmar se trabalham sábado (Q9 ficou seg-sex).
- Nome e logo da construtora (Q21).

## Ações sensíveis feitas nesta sessão

- Aceitei a tela "Yes, I trust this folder" do Claude Code em `C:\Users\Otavi\acompanhador-obras` (pasta criada por mim) nos 3 terminais de código.
- Nenhum arquivo apagado. Nada publicado, sem remoto git.
