# Plano: Financeiro orçado x realizado (gastos reais)

- **Criado em:** 2026-11-10 15:37
- **Pedido do Otavio:** o diretor precisa saber quanto já foi gasto, lançar os gastos reais e comparar orçado x realizado em dois momentos: no meio da obra, por fatias (etapa, atividade, categoria e mês), e no fim, com a visão total. A pergunta que a tela responde é: "estou gastando a mais ou a menos?".
- **Base:** `2026-11-09-14-47-banco-postgres-api.md` (Postgres + API). As decisões Q1-Q23 continuam valendo, exceto a regra do R$ do encarregado, que muda (item 3 abaixo).

## Decisões do Otavio (10/11)

1. **Entrada:** lançamento manual na tela + importação de planilha (CSV e XLSX), com prévia e validação linha a linha antes de gravar.
2. **Nível:** cada gasto tem **etapa** (EAP Caixa) e **categoria**, ambas obrigatórias, e **atividade** opcional. Sem atividade, o gasto entra como "Geral da etapa".
3. **Perfis:** por enquanto não há exclusividade por perfil: diretor, engenheiro e encarregado lançam e veem gastos. **Isso sobrescreve a regra "encarregado nunca recebe R$"** (plano de 09/11 e API `ocultarValores`). A ocultação vira uma flag desligada, `OCULTAR_VALORES_ENCARREGADO = false`, para religar depois sem reescrever. Quem enxerga qual obra continua igual: engenheiro e encarregado só veem as obras deles.
4. **Comparação no meio da obra:** gasto real x **valor do que já foi feito** (valor agregado = orçado × % físico apontado), e não gasto x orçado total. Daí sai a projeção do custo final.

## ATUALIZAÇÃO 2026-11-10 (fim da tarde): regra de SALDO substitui a decisão 4

O Otavio testou: lançou R$ 300 na atividade 1.01 (orçado R$ 4.738,50, nada feito ainda) e a tela disse "acima do orçado". Isso não serve para o fluxo da construtora, em que se cria a obra com o custo geral e os gastos vão descontando ao longo da obra. **Nova regra (sobrescreve a decisão 4 e a tabela de faixas abaixo):**

- O orçado é um **saldo**: cada gasto desconta do orçado da atividade (se informada), da etapa e da obra.
- **Só estoura quando o gasto passa do orçado** naquele nível. Gasto em algo sem orçado também conta como estouro.
- "Perto do limite" (amarelo) a partir de 90% do orçado usado, se não estiver concluído (**proposta, NÃO CONFIRMADA**). Concluído dentro do orçado fica verde.
- O "valor do que foi feito" continua aparecendo, mas só como avanço da obra; não define mais a cor.
- Na tela: cards Orçado · Gasto até agora · Saldo disponível (ou "Estourou R$ X") · Situação do custo · Avanço da obra (concluída: Custo final). Na tabela: Orçado · Gasto · Saldo · Uso do orçado (barra) · % feito · Situação. Projeção pelo CPI removida.
- Código: `faixaPorSaldo` (substitui `faixaPorCpi`), `IndicadoresCusto` ganhou `saldo`, `consumido` e `estouro`; `custoFinalProjetado` = max(orçado, gasto).

## Conceitos (nomes da tela entre aspas) — versão original, ver atualização acima

| Sigla interna | Tela | Cálculo |
| --- | --- | --- |
| BAC | "Orçado" | soma de `valorOrcado` (obra, etapa ou atividade) |
| EV | "Valor do que foi feito" | `valorAgregado`, já calculado em `indicadoresObra/Etapa` |
| PV | "Previsto até hoje" | `valorPlanejado`, já existe |
| AC | "Gasto real" | soma dos gastos com `data <= hoje` |
| CPI | "Eficiência de custo" | EV / AC (null se AC = 0) |
| Desvio | "Gastando X a mais/a menos" | AC − EV em R$ e em % de EV |
| EAC | "Custo final projetado" | AC + (BAC − EV) / CPI. Se CPI for null ou EV = 0, EAC = BAC + max(0, AC − EV) |
| VAC | "Sobra/estouro projetado" | BAC − EAC |

**Faixa de custo (proposta, NÃO CONFIRMADA pelo Otavio):** CPI ≥ 0,98 = "Dentro do orçado" (verde) · 0,90 a 0,98 = "Atenção" (amarelo) · < 0,90 = "Acima do orçado" (vermelho) · sem gasto = "Sem gastos" (cinza). Fica numa constante para ajuste.

**Fim de obra:** com status `concluida` (ou etapa/atividade a 100%), EV = BAC e a comparação é direta: orçado x realizado final, com diferença em R$ e em %.

**Categoria não tem orçado.** O orçado só existe por etapa e atividade, então a quebra por categoria mostra só o gasto real (valor e % do total). Orçar por categoria fica fora deste passo.

## Contrato (shared) — Fundação implementa, os outros já codam contra ele

```ts
export type CategoriaGasto = 'material' | 'mao_de_obra' | 'equipamento' | 'terceiros' | 'outros';
export const CATEGORIAS_GASTO: Record<CategoriaGasto, string>; // rótulos pt-BR

export interface Gasto {
  id: string;
  obraId: string;
  data: ISODate;               // data do gasto (competência)
  etapaCodigo: number;         // obrigatório
  atividadeId?: string;        // opcional (Atividade.id); ausente = "Geral da etapa"
  categoria: CategoriaGasto;   // obrigatório
  valor: number;               // R$ > 0, 2 casas
  descricao: string;           // obrigatório, curto
  fornecedor?: string;
  documento?: string;          // nº da nota/recibo
  autorId: string;
  criadoEm: string;            // ISO datetime (servidor)
  importacaoId?: string;       // lote de importação, se veio de planilha
}
// Obra ganha: gastos: Gasto[]  (GET /api/obras e /api/obras/:id já devolvem)

export interface IndicadoresCusto {
  orcado: number; agregado: number; previsto: number; gasto: number;
  cpi: number | null; desvio: number; desvioPct: number | null;
  custoFinalProjetado: number; sobraProjetada: number;
  faixa: 'dentro' | 'atencao' | 'acima' | 'sem_gastos';
}
export function indicadoresCustoObra(obra: Obra, hoje: ISODate): IndicadoresCusto;
export function indicadoresCustoEtapa(obra: Obra, etapaCodigo: number, hoje: ISODate): IndicadoresCusto;
export function indicadoresCustoAtividade(obra: Obra, atividadeId: string, hoje: ISODate): IndicadoresCusto;
/** Linha "Geral da etapa": gastos da etapa sem atividade. */
export function gastoGeralEtapa(obra: Obra, etapaCodigo: number, hoje: ISODate): number;
export function gastoPorCategoria(obra: Obra, hoje: ISODate, etapaCodigo?: number): { categoria: CategoriaGasto; valor: number; pct: number }[];
/** Fatias por mês: gasto do mês, valor feito no mês, previsto no mês e os acumulados. */
export function custoMensal(obra: Obra, hoje: ISODate): { mes: string; gasto: number; agregado: number; previsto: number; gastoAcum: number; agregadoAcum: number; previstoAcum: number }[];
export const FAIXAS_CUSTO: { atencao: number; acima: number }; // 0.98 e 0.90

// Importação (puro, roda no navegador e na API)
export interface LinhaImportacao { linha: number; dados?: Omit<Gasto, 'id'|'obraId'|'autorId'|'criadoEm'|'importacaoId'>; erros: string[]; }
export function validarLinhasGasto(obra: Obra, linhas: Record<string, string>[]): LinhaImportacao[];
export const COLUNAS_PLANILHA_GASTO: string[]; // data;etapa;atividade;categoria;valor;descricao;fornecedor;documento

export const OCULTAR_VALORES_ENCARREGADO = false;
```

**Planilha:** separador `;` ou `,` (detecção automática), valor em formato BR (`1.234,56`) ou com ponto, data `dd/mm/aaaa` ou ISO. Etapa por código (`3`) ou nome. Atividade por código ou nome dentro da etapa. Categoria por rótulo, sem diferenciar acento nem maiúscula. Linha com erro não grava, e a prévia mostra o motivo. A gravação é tudo ou nada só das linhas válidas, depois que o usuário confirma.

## API — Fundação

- Tabela `gastos` (migration nova) com os campos acima: `valor numeric(14,2)`, `data date`, índice por `obra_id` e FK para a obra (cascade ao excluir).
- `GET /api/obras/:id/gastos` · `POST /api/obras/:id/gastos` · `PATCH /api/gastos/:id` · `DELETE /api/gastos/:id`. Quem acessa a obra pode tudo; sem restrição por perfil, por decisão do Otavio.
- `POST /api/obras/:id/gastos/importar` recebe `{ linhas: Record<string,string>[] }`. O servidor revalida com `validarLinhasGasto`, grava as válidas numa transação com um `importacaoId` e devolve `{ gravadas, erros: LinhaImportacao[] }`. `DELETE /api/importacoes/:importacaoId` desfaz um lote inteiro.
- `paraUsuario` passa a respeitar `OCULTAR_VALORES_ENCARREGADO`; o web, em `podeVerValores`, também.
- Exemplos: gastos fictícios coerentes nas 6 obras de exemplo, todos marcados como exemplo. O galpão deve ficar ~12% acima no que já foi feito, a geminada dentro, o sobrado abaixo e a casa concluída com o fechamento final ~4% acima. Assim todas as faixas aparecem.
- Testes: unitários do cálculo e da validação da planilha (shared) + e2e das rotas.

## Store (web) — Fundação

`lancarGasto(g)`, `editarGasto(id, parcial)`, `excluirGasto(id)`, `importarGastos(obraId, linhas) => Promise<{gravadas, erros}>` e `desfazerImportacao(obraId, importacaoId)`. As quatro primeiras usam a mesma fila por obra que já existe (otimista + toast em erro). `obra.gastos` vem junto com a obra.

## Telas

### Gestão — aba Financeiro (refeita) + painel

- **Topo, 5 cards:** Orçado · Gasto real · Valor do que foi feito · "Gastando X% a mais/a menos" (cor da faixa) · Custo final projetado (com sobra ou estouro).
- **Por etapa:** tabela expansível etapa → atividades + linha "Geral da etapa". Colunas: Orçado, % feito, Valor feito, Gasto, Desvio R$ e %, Projeção, faixa. Ordenada por maior estouro. A edição de valor orçado que já existe continua aqui.
- **Fatias no tempo:** gráfico mensal com barras (gasto do mês x valor feito no mês) e linhas acumuladas (gasto, valor feito, previsto). Mesma paleta dos gráficos atuais.
- **Por categoria:** barras horizontais com gasto e % (a obra toda ou a etapa escolhida).
- **Fechamento:** obra concluída mostra o bloco "Fechamento" no lugar da projeção: orçado x realizado final, total e por etapa, com diferença em R$ e %.
- **Painel do portfólio:** card/coluna de custo por obra (faixa + desvio %) e total do portfólio. Na lista de obras, um badge de custo.
- **ObraDetalhePage:** registra a aba nova **Gastos** (componente do Campo) e remove o filtro que escondia Financeiro do encarregado (via `podeVerValores`).

### Campo — aba Gastos (lançamento) + importação

- **Aba Gastos** (`pages/obra/AbaGastos.tsx` + `pages/gastos/**`): lista com filtros (período, etapa, atividade, categoria, texto), total filtrado, editar e excluir com confirmação.
- **Novo gasto:** folha inferior no celular, diálogo no desktop. Campos: data (padrão hoje), etapa, atividade (opcional, filtrada pela etapa), categoria, valor em R$ com máscara BR, descrição, fornecedor e documento. Precisa funcionar bem em 390 px, porque o encarregado lança no canteiro.
- **Importar planilha:** escolher arquivo CSV/XLSX → prévia com linhas válidas e com erro (motivo por linha) → confirmar → resumo. Botão "Baixar modelo de planilha" (CSV com cabeçalho + 2 linhas exemplo). Mostra os lotes importados e permite "Desfazer importação".
- **XLSX:** só biblioteca JS pura, sem binário nativo (o Windows daqui bloqueia `.node`). A escolha fica com o terminal, e precisa ser justificada na nota.
- Telas de Campo que escondiam R$ passam a mostrar, via `podeVerValores`.

## Posse de arquivos (evita conflito)

| Terminal | Arquivos |
| --- | --- |
| Fundação | `packages/shared/**`, `apps/api/**`, `apps/web/src/store/**`, `apps/web/src/lib/api.ts` |
| Telas-Gestão | `pages/obra/AbaFinanceiro.tsx`, `pages/obra/AbaVisaoGeral.tsx`, `pages/ObraDetalhePage.tsx`, `pages/PainelPage.tsx`, `pages/ObrasPage.tsx`, `components/charts/**` |
| Telas-Campo | `pages/obra/AbaGastos.tsx` (novo), `pages/gastos/**` (novo), `pages/campo/**`, `pages/nova-obra/**` |
| Orquestrador | `components/ui/**`, `App.tsx`, layout, docs. Quem precisar mexer pede na nota. |

## Ordem

1. **Fundação, primeiro:** tipos + assinaturas + `OCULTAR_VALORES_ENCARREGADO` no shared, com stubs que compilam, publicados em até ~15 min e avisados na nota. Gestão e Campo começam as telas em cima disso.
2. Em paralelo: Fundação faz cálculo, testes, migration, rotas, store e exemplos; Gestão faz o Financeiro e o painel; Campo faz Gastos e a importação.
3. Integração: o orquestrador sobe API + web, e cada terminal valida a própria tela com dados reais.
4. Conferência final (typecheck, test, build), handover e entrega para o Otavio testar, **sem commit**.

## Fora deste passo

- Orçamento por categoria e orçamento de mão de obra x material.
- Anexo do arquivo da nota fiscal (depende do upload real de fotos/arquivos).
- Contas a pagar e fluxo de caixa futuro (vencimentos).
- Integração com sistema contábil ou ERP.
- Religar a restrição de R$ por perfil (é só virar a flag, mas exige revisar as telas).
