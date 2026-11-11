# Handover: integração web + API e testes ponta a ponta

- **Criado em:** 2026-11-10 14:03
- **Anterior:** `2026-11-07-20-04-kickoff-e-contratos.md`. Em 09/11 não houve handover; o que aconteceu está na nota do canvas "Status- Acompanhador de Obras" e no git log (commits até `500d7a2`).
- **Plano vigente:** `docs/planejamento/2026-11-09-14-47-banco-postgres-api.md`.
- **Estado do git:** NADA desta etapa foi commitado. O Otavio testa primeiro e depois commitamos. São 33 entradas no `git status`.

## O que está pronto

- O web fala com a API real (Postgres): login com e-mail e senha, Topbar com o usuário logado e Sair, tela de Usuários (só diretor) e Excluir obra (só diretor, digitando o nome).
- Testes ponta a ponta feitos pelos terminais no canvas, em 10/11:
  - **Gestão:** login, as 5 abas nas 6 obras (1440 e 390 px), Replanejar, Financeiro, Usuários, Excluir, visão da engenheira e toast de conflito 409.
  - **Campo:** wizard com baseline v1, Modelos e apontamento do encarregado com foto e observação, com persistência após F5.
  - **Encarregado:** não recebe R$ nem pela API (orçamento = 100, pesos), e os bloqueios por URL funcionam.
  - **Fundação:** Docker de produção testado num projeto isolado (`-p obras-prodteste`, porta 8080) e derrubado depois.
- `pnpm typecheck` verde nos 3 pacotes, `pnpm test` com 49/49 (43 shared + 6 web) e `pnpm build` verde.

## Correções feitas hoje (sem commit)

| Onde | O quê |
| --- | --- |
| `apps/api/src/rotas/obras.ts` (Fundação) | Engenheiro não pode mais trocar o engenheiro responsável no PUT (403). Responsável novo precisa estar ativo, e o engenheiro precisa ter perfil engenheiro ou diretor. |
| `apps/api/src/scripts/criar-usuario.ts` (orquestrador) | `pnpm usuario:criar -- ...` falhava porque o pnpm repassa o `--`. Agora filtra. |
| `apps/web/src/store/index.tsx` + `pages/modelos/ModeloDetalhe.tsx` (orquestrador) | "Restaurar modelo padrão" agora faz `DELETE /api/modelos/:tipo`. Antes gravava uma cópia do padrão, que congelava o modelo. |
| `pages/nova-obra/PassoParametros.tsx` (Campo) | Usuários de exemplo aparecem num grupo separado no wizard. Antes a engenheira de teste nem se via no select. |
| `pages/modelos/regras.ts` (Campo) | A comparação "modelo foi editado" ignora a ordem das chaves, porque o jsonb reordena. Antes o Restaurar ficava sempre habilitado. |
| `pages/UsuariosPage.tsx` (Gestão) | Exemplo com senha é editável; cartões no celular; não-diretor em `/usuarios` volta pro painel. |
| `pages/LoginPage.tsx` (Gestão) | Validação local em português. Antes, Enter com campos vazios mostrava o erro cru em inglês. |
| `pages/obra/comum.tsx` (Gestão) | O texto do estado vazio muda conforme o perfil. |
| `docs/deploy/2026-11-09-coolify.md` (Fundação) | O diretor inicial em produção é criado com `node dist/setup.js` no container `api`. `COOKIE_SECURE=true` em HTTP quebra o login sem mostrar erro. |

## Ambiente deixado rodando

- Docker Desktop ligado e Postgres dev no container `obras-db-dev`, porta 5433.
- API em `http://127.0.0.1:3333` (`pnpm dev:api`) e web em `http://127.0.0.1:5180` (`pnpm dev`). Os dois foram iniciados pelo Claude como tarefas em background; se a sessão fechar, rode de novo.
- Banco com as 6 obras de exemplo recém-recriadas e os modelos no padrão.
- Logins de teste, com o Otavio de acordo em mantê-los. A senha é `teste-obras-2026`:
  - `diretor@teste.local` (diretor);
  - `carla@teste.local` (engenheira Carla Exemplo);
  - `ze@teste.local` (encarregado Zé Demonstração).
- O login do Otavio (`otavio@campestre.social.br`) é o diretor inicial; a senha está em `apps/api/.env`.
- O usuário `teste.gestao.e2e@teste.local` ficou desativado, porque a API não tem exclusão de usuário.
- Aviso do Docker: o volume `acompanhador-obras_obras-db-dev` foi criado com outro nome de projeto. Funciona, mas o `docker-compose.dev.yml` novo espera o projeto `obras-dev`. Vale alinhar antes do commit.

## Decisões pendentes do Otavio

1. **O percentual pode diminuir?** Hoje pode, com aviso de "correção", e a API aceita. Se for proibir, a mudança vai em `shared/apontamento.ts`, na API e na `FolhaApontamento`.
2. **Obra nova aparece "Atrasada" no primeiro dia.** O SPI dá 0 porque o planejado é quase zero. Sugestão: com realizado 0 e desvio menor que cerca de 1 pp, mostrar "Não iniciada". A regra está em `packages/shared/src/calculo.ts` (`faixaPorSpi`).
3. **Engenheiro pode criar obra com outro engenheiro como responsável?** Hoje pode, porque o wizard deixa, e não vaza dado. A Fundação deixou isso para decisão.
4. **Dois toasts no conflito** (o de sucesso otimista e o de erro). Foi considerado aceitável; dá para ajustar se incomodar.

## Não testado / limitações conhecidas

- Toast quando a API cai: não foi forçado.
- O 500 ao salvar usuário, que apareceu uma vez, coincidiu com o restart do `tsx watch` (13:54:58 e 13:55:00). A API não logou nenhum erro, então foi o proxy do Vite sem destino. Não é bug do código.
- Fotos continuam simuladas (só o nome do arquivo).
- O bundle do web tem 945 kB (aviso do Vite).
- Carnaval e Corpus Christi seguem marcados como NÃO CONFIRMADO no motor.

## Próximos passos

1. O Otavio testa em `http://127.0.0.1:5180`.
2. Ajustar o que ele apontar e resolver as decisões acima.
3. Alinhar o nome do volume do compose dev e fazer o commit da etapa.
4. Seguir para os pontos de "Fora deste passo" do plano: upload de fotos, backup e recuperação de senha.
