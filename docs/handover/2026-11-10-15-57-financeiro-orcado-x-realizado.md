# Handover: Financeiro orçado x realizado

- **Criado em:** 2026-11-10 15:57
- **Plano:** `docs/planejamento/2026-11-10-15-37-financeiro-orcado-x-realizado.md`
- **Anterior:** `2026-11-10-14-03-integracao-api-e-testes.md`. A integração com a API também segue sem commit.
- **Estado do git:** NADA commitado. São 67 entradas no `git status`, somando a integração da API e o financeiro. O Otavio testa antes do commit.
- **Detalhe completo:** nota do canvas "Status- Financeiro orçado x realizado", com as seções de cada terminal.

## Decisões do Otavio aplicadas

- Gastos entram por lançamento manual e por importação de planilha (CSV/XLSX).
- Cada gasto tem etapa e categoria obrigatórias e atividade opcional; sem atividade, vira "Geral da etapa".
- Todos os perfis lançam e veem gastos. **A regra "encarregado nunca recebe R$" foi desligada** pela flag `OCULTAR_VALORES_ENCARREGADO = false` (`packages/shared/src/custo.ts`). Quem vê qual obra não mudou.
- No meio da obra, a comparação é gasto real x valor do que foi feito; daí sai a projeção do custo final. No fim da obra entra o bloco "Fechamento", com orçado x realizado.

## O que foi entregue

| Frente | Entrega |
| --- | --- |
| Fundação | `shared/custo.ts`: indicadores de custo por obra, etapa e atividade, "Geral da etapa", categorias, mês a mês e validação da planilha (formatos BR), com 21 testes. Migration `0002_gastos` e rotas em `apps/api/src/rotas/gastos.ts`: CRUD, importar e desfazer lote. Store com fila por obra. Gastos fictícios nas 6 obras de exemplo (`exemplo = true`, fornecedores "Exemplo"). E2E `e2e-gastos.ts`: 36/36 no stack isolado de produção. |
| Telas-Gestão | Aba Financeiro refeita: 5 cards; por etapa → atividades + Geral (cartões no celular); mês a mês; por categoria; Fechamento na obra concluída. KPI "Custo do portfólio" no Painel, badge de custo nos cards e coluna Custo na lista de Obras. |
| Telas-Campo | Aba Gastos: filtros, busca, lançar, editar e excluir; "Salvar e lançar outro"; máscara de R$. Importação CSV/XLSX com prévia linha a linha, aviso de possível repetição, modelo para baixar e desfazer lote. Botões "Lançar gasto" e "Ver gastos" na tela de campo. |
| Orquestrador | Faixa de custo sem arredondar a eficiência: 0,898 (+11,4%) passou a cair em "acima" em vez de "atenção". Projeção pela forma direta `orçado × gasto ÷ valor feito`. |

**Dependência nova:** `read-excel-file` 9.3.12 em `apps/web`, só leitura e JS puro. O SheetJS foi descartado porque a versão do npm tem vulnerabilidades conhecidas.

**Validação:**
- `pnpm typecheck` verde; `pnpm test` com 64 testes no shared e 19 no web; `pnpm build` verde.
- Gestão e Campo validaram no portal com dados reais, em 1440 e 390 px.
- Tudo o que foi criado como TESTE foi apagado ou desfeito.

**Números dos exemplos** (hoje = 10/11/2026):

| Obra | Situação de custo |
| --- | --- |
| Galpão | +12,0% acima |
| Casa concluída | fecha +4,0% (atenção) |
| Santa Terezinha | +5,0% atenção |
| Torre | +1,0% dentro |
| Geminadas | 0,0% ("Gastando o mesmo") |
| Sobrado | −7,0% dentro |

## Ambiente

- Banco dev com a migration 0002 aplicada e exemplos recriados com gastos.
- API em 127.0.0.1:3333 e web em 127.0.0.1:5180, rodando como tarefas em background desta sessão.
- **Memória:** cerca de 1,5 GB livres às 15:57. Mais cedo os servidores foram derrubados por falta de memória; se cair de novo, rode `pnpm dev:api` e `pnpm dev`.
- Existe uma obra real **"jardim das hortensias"**, sem gastos, que não foi criada pelos testes. Não foi tocada.

## Decisões pendentes do Otavio

1. **Faixa de custo**, proposta e não confirmada: eficiência (valor feito ÷ gasto) ≥ 0,98 = dentro · 0,90 a 0,98 = atenção · < 0,90 = acima. Em termos de gasto: até ~2% acima = dentro; de 2% a 11% acima = atenção; acima disso, vermelho.
2. **Gasto antes de qualquer avanço físico** (material comprado adiantado) hoje sai "acima", em vermelho. A sugestão é mostrar "sem avanço ainda".
3. **Encarregado lançar sem ver R$:** só importa se a restrição por perfil for religada.
4. Continuam pendentes as decisões do handover das 14:03: percentual que diminui, obra nova "Atrasada", engenheiro criar obra para outro e 2 toasts no conflito.

## Não testado

- XLSX salvo pelo Excel de verdade. Foi testado um .xlsx gerado no mesmo padrão OOXML.
- CSV em ANSI (windows-1252) no navegador; está coberto só por código.

## Próximos passos

1. O Otavio testa em `http://127.0.0.1:5180`: Financeiro, aba Gastos, importação e Painel.
2. Ajustes do teste e decisões acima.
3. Alinhar o nome do volume do compose dev e fazer o commit, em 2 commits (integração da API e financeiro) ou 1, como o Otavio preferir.
4. Fora deste passo: orçamento por categoria, anexo da nota fiscal, contas a pagar e fluxo de caixa.

## Atualização (fim da tarde, 10/11): regra de saldo

- **Pedido do Otavio:** o gasto desconta do orçado e só é estouro quando passa dele. Antes, R$ 300 numa atividade sem avanço aparecia como "acima". Essa regra **sobrescreve** a comparação "gasto x valor do que foi feito" (decisão 4 do plano). O detalhe está na seção "ATUALIZAÇÃO" do plano.
- **Arquivos:**
  - `packages/shared/src/{custo.ts,types.ts,custo.test.ts}`: `faixaPorSaldo` e os campos `saldo`, `consumido` e `estouro`; testes com o caso do Otavio, 65/65.
  - `apps/web/src/pages/obra/{AbaFinanceiro.tsx,custo.tsx}`, `PainelPage.tsx` e `ObrasPage.tsx`.
- **Conferido no portal:** em "sobrado de teste", a 1.01 mostra orçado R$ 4.738,50 − gasto R$ 300 = saldo R$ 4.438,50, 6,3% usado, "Dentro".
- **Exemplos com a regra nova:**
  - A casa concluída estoura (104%).
  - As demais obras ficam "dentro" no total, mas o galpão e o Santa Terezinha têm 10 etapas estouradas cada, e a torre tem 3. O card "Situação do custo" mostra essa contagem.
- **Pendente do Otavio:**
  1. Confirmar o limite de 90% para "perto do limite".
  2. Decidir se a obra deve aparecer vermelha quando QUALQUER etapa estourar. Hoje o saldo de uma etapa compensa o estouro de outra no total da obra.
- **API:** a de dev caiu uma vez porque um processo antigo ainda ocupava a porta 3333. Foi religada.
- Tudo segue sem commit.
