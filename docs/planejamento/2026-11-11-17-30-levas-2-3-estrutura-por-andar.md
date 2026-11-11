# Levas 2 e 3: estrutura por andar editável na obra

Criado em 11/11/2026, 17:30. Continuação de `2026-11-11-16-20-cronograma-por-pavimento.md` (decisões B e D do Otavio).

- **Leva 2 (B):** na própria obra, alternar uma atividade entre "obra toda" e "por andar". Os itens novos herdam a baseline da atividade original.
- **Leva 3 (D):** adicionar e remover pavimento (ou unidade) numa obra já criada.

## Divisão do trabalho (terminais no canvas)

| Terminal | Escopo | Não mexe em |
| --- | --- | --- |
| Núcleo | `packages/shared` (novo `estrutura.ts` + testes, export no `index.ts`) e `apps/api` (PUT sincronizando a baseline, guardas) | `apps/web` |
| Telas | `apps/web` (botões e diálogos na grade "Por andar" e no Cronograma) | `packages/shared`, `apps/api` |

Ninguém faz commit. O Maestro integra, testa e commita.

## Contrato: `packages/shared/src/estrutura.ts`

```ts
type NovoId = (prefixo: string) => string;

/** Locais de andar (tudo que não é tipo 'obra'), ordenados por `ordem`. */
export function locaisDeAndar(obra: Obra): Local[];
/** true se a atividade tem item em algum local de andar. */
export function atividadePorAndar(obra: Obra, atividadeId: string): boolean;

/** Leva 2: "obra toda" → um item por andar. `localIds` vazio/ausente = todos os andares. */
export function dividirPorAndar(obra: Obra, atividadeId: string, novoId: NovoId, localIds?: string[]): Obra;
/** Leva 2: "por andar" → um item só no local "Obra toda" (cria esse local se não existir). */
export function juntarEmObraToda(obra: Obra, atividadeId: string, novoId: NovoId): Obra;

/** Leva 3: insere um andar na posição `posicao` (0 = mais baixo) e cria os itens das atividades por andar. */
export function adicionarPavimento(
  obra: Obra,
  p: { nome: string; tipoPavimento?: TipoPavimento; tipo: 'pavimento' | 'unidade'; posicao: number },
  novoId: NovoId,
): Obra;
/** Leva 3: motivo de bloqueio, ou null se pode remover. */
export function motivoBloqueioRemocao(obra: Obra, localId: string): string | null;
/** Leva 3: remove o andar e os itens dele. Lança Error(motivo) se bloqueado. */
export function removerPavimento(obra: Obra, localId: string): Obra;

/**
 * Baseline inicial (v1) ajustada à estrutura de `depois`, partindo da baseline de `antes`. null = sem baseline.
 * Usada pelas 4 funções acima (para a tela já mostrar certo) e pela API no PUT (a API NÃO confia na baseline do corpo).
 */
export function sincronizarBaselineEstrutura(antes: Obra, depois: Obra): Baseline | null;
```

Todas são **puras**: devolvem uma Obra nova e não mexem na de entrada. As quatro de estrutura já devolvem `baselines[0]` sincronizada.

## Regras

**Valor:** o total da atividade é preservado e **dividido igualmente** entre os itens dela, arredondado em centavos, com o resto no último. A baseline segue a mesma divisão.

**dividirPorAndar**
- Precisa ter exatamente 1 item, num local tipo 'obra'. Se não, lança Error.
- Cria um item por andar escolhido. **O item original vira o do primeiro andar (mantém o id, preservando o histórico de apontamentos)**; os outros recebem `novoId('item')`.
- Datas, % e início/fim real são copiados do original.
- Baseline: cada item novo recebe as **datas** da entrada de baseline do original. Os valores seguem a regra de valor.

**juntarEmObraToda**
- Precisa ter ≥ 1 item. Lança Error se não tiver itens ou se já estiver em "obra toda" (1 item num local tipo 'obra').
- **1 item num andar** (correção do teste geral, caso L4): o item volta para o local 'obra' mantendo id, datas, % e início/fim real; a baseline mantém a entrada.
- Com ≥ 2 itens: mantém o id do item do primeiro andar e move-o para o local 'obra' (criado com `novoId('local')`, nome "Obra toda", `ordem: -1`, se faltar).
- Datas = span dos itens. % = média ponderada pelo valor (arredondada). inicioReal = o menor; fimReal = o maior, só se todos tiverem.
- Baseline: o item que fica recebe o span das entradas antigas e a soma dos valores. As entradas dos itens removidos saem.
- Os apontamentos dos itens removidos continuam no histórico, sem item (aceito).

**adicionarPavimento**
- Novo local com `novoId('local')`. As `ordem` dos andares são renumeradas para 0..n-1 com o novo na `posicao`. O local 'obra' fica de fora.
- Para cada atividade **por andar** desta obra: só cria o item se, no modelo `MODELOS[obra.tipo]`, a atividade de mesmo `codigo` não tiver `tiposPavimento` ou ele incluir o `tipoPavimento` novo. Unidade (geminadas) sempre cria.
- Datas do item novo = as do item do **andar vizinho de baixo** (se não houver, o de cima). `percentual: 0`, sem real.
- Depois, redivide o valor da atividade entre os itens (regra de valor).
- Baseline: o item novo copia as datas da entrada do vizinho usado. Os valores seguem a redivisão.

**motivoBloqueioRemocao / removerPavimento**: bloqueia, com uma mensagem em português para o usuário, quando:
- é o último andar da obra **e ainda tem itens** (correção do caso L4: andar sem nenhum item pode ser removido mesmo sendo o último; a obra volta a ser de local único);
- algum item do andar tem `percentual > 0` ou apontamento no histórico;
- a remoção deixaria uma atividade sem itens e ela tem gasto (`obra.gastos` com aquele `atividadeId`).

Ao remover:
- Os itens do andar saem, e o valor deles é redividido entre os itens restantes da atividade.
- Atividade que fica sem itens é removida, e o valor dela é redistribuído **proporcionalmente** entre as outras atividades da mesma etapa. Se a etapa ficar sem atividade, **bloqueia** (mensagem).
- As predecessoras de etapa não mudam. As `ordem` são renumeradas. A baseline perde as entradas removidas e os valores seguem a redivisão.

**sincronizarBaselineEstrutura(antes, depois)**
- Parte de `antes.baselines[0]`.
- Para cada item de `depois`:
  - se ele existia em `antes` **e** a atividade dele não mudou de conjunto de itens, mantém a entrada;
  - senão, aplica as regras acima (split: datas do original; merge: span; andar novo: datas do vizinho).
- Remove as entradas de itens que não existem mais.
- Valores: em toda atividade cujo conjunto de itens mudou, o total da baseline da atividade é preservado e redividido igualmente.
- **Determinística:** a API chama com `antes` = obra no banco e `depois` = corpo do PUT.

## Avanço no PUT

Adicionado em 11/11/2026 (aprovado pelo Maestro). O PUT ignora `percentual`/`inicioReal`/`fimReal` do corpo e copia do banco por id (avanço só muda por apontamento). Para as Levas 2 e 3, nova função pura no shared:

```ts
/** Recalcula o avanço SÓ dos itens das atividades cujo conjunto de ids mudou, a partir de `antes` (no servidor: o banco). */
export function sincronizarAvancoEstrutura(antes: Obra, depois: Obra): Obra;
```

- Item que já existia: copia o avanço dele em `antes`.
- Split: itens novos copiam `percentual`/`inicioReal`/`fimReal` do item original de `antes`.
- Merge: `percentual` = média ponderada pelo `valorOrcado` de **antes** (valores do banco, não do corpo), arredondada; `inicioReal` = o menor; `fimReal` = o maior só se todos tinham.
- Andar novo: 0, sem real. Andar removido: os itens somem (a guarda de avanço > 0 continua barrando).
- As 4 funções de estrutura chamam essa função, então a tela já mostra o que o servidor vai gravar. No PUT ela roda depois da cópia do avanço do banco.

## API (Núcleo)

- `PUT /api/obras/:id`: depois de validar, calcula `sincronizarBaselineEstrutura(atual, corpo)`. Se a v1 existir e algo mudou, regrava as entradas de `baseline_itens` da v1 (nova função no repo: apaga as da v1 e insere as novas, na mesma transação).
- Guarda no PUT: se um local de `atual` sumiu do corpo e tinha item com `percentual > 0`, responde 400 com mensagem.
- A régua de justificativa (`desviosParaJustificar`) continua igual. Itens novos sem baseline em `atual` ficam fora dela.
- Testes: `estrutura.test.ts` cobrindo split, merge, add (com filtro `tiposPavimento`), remove (cada bloqueio), valores preservados e baseline. E um e2e simples da API, se couber (padrão `apps/api/src/scripts/e2e-*.ts`).

## Telas (Telas)

- Só diretor e engenheiro veem os controles. Ações de estrutura **salvam na hora** (`atualizarObra(novaObra)` + toast), com diálogo de confirmação. Ficam **bloqueadas enquanto houver alteração pendente** no Cronograma (avisa: "Salve ou descarte as alterações antes").
- **Grade "Por andar"** (`GradePorAndar.tsx`): na célula do nome de cada atividade, um botão discreto:
  - "Dividir por andar" (atividade obra toda): diálogo com checkboxes dos andares, todos marcados por padrão, e um texto explicando valor e baseline.
  - "Juntar em obra toda" (atividade por andar): confirmação mostrando o % resultante.
- **Pavimentos** (novo componente, por exemplo `EditorAndaresObra.tsx`): botão "Andares" (ou "Unidades" nas geminadas) no cabeçalho do Cronograma, abrindo um diálogo com:
  - a lista dos andares na ordem;
  - remover, desabilitado com o motivo de `motivoBloqueioRemocao` no hover;
  - adicionar (nome, tipo de pavimento quando for pavimento, posição "abaixo de / acima de").
  - Mostra quantos itens serão criados ou removidos.
- Mexer no `AbaCronograma.tsx` só o necessário: passar `podeEditar` e `temMudanca` para a grade, e montar o botão do editor de andares.
- Obra sem andares (casa térrea, galpão): o botão "Andares" também aparece. Adicionar o primeiro andar transforma a obra (as atividades continuam "obra toda" até alguém dividir).
- Verificação: `pnpm typecheck`, `pnpm test` e conferir no `Portal Campo` (http://127.0.0.1:5180, já logado como diretor).
