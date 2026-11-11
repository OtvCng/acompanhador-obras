# Cronograma por pavimento (estrutura da tela de lançamento)

Criado em 11/11/2026, 16:20. **Status: proposta, aguardando decisões do Otavio.**

## Contexto (pedido do Otavio)

O Cronograma vai ser **o único lugar de lançamento de avanço** e a tela mais usada da obra. Para isso, cada andar precisa ser tratado separadamente nas fases que são independentes por andar. Exemplos:

- **Sobrado:** o térreo terminou a parte cinza e o superior está em 50%; o piso foi aplicado em um andar e no outro não.
- **Prédio de 8 andares:** cada andar recebe atualizações independentes em fases específicas. É preciso deixar isso visual para lançar rápido.
- **Casa de 3 andares:** tem que ter 3 atividades, uma por andar, nas etapas independentes por andar.

## O que já existe (conferido no código em 11/11)

1. **O modelo de dados já separa por andar.** A obra tem `locais` (pavimentos ou unidades). Atividades marcadas `porLocal` no modelo viram **um item por andar**, cada um com datas, % e valor próprios. É nesse item que o avanço é lançado.
2. **O que é por andar está fixo no modelo do tipo de obra** (a obra não consegue mudar depois de criada):

   | Tipo | Desdobra em | Atividades por local |
   | --- | --- | --- |
   | Casa térrea | nada (1 local) | 0 de 48 |
   | Comercial/galpão | nada (1 local) | 0 de 48 |
   | Geminadas | unidades | 41 de 48 |
   | Sobrado | pavimentos | 19 de 48 |
   | Prédio 3-6 e 7+ | pavimentos (filtrado por tipo de pavimento) | 32 de 56 |

3. **Lacunas no sobrado:** são por andar: estrutura, vergas, alvenaria, impermeabilização de áreas molhadas, revestimentos internos, forro, pisos, pintura, elétrica e parte da hidráulica e do esgoto. **Não** são por andar, e provavelmente deveriam ser: **5 Esquadrias, 6 Vidros, 14 Acabamentos e 18 Louças e metais**.
4. **Casa de 3 andares:** hoje se cadastra como **Sobrado** com 3 pavimentos (o editor de pavimentos do Nova obra permite). "Casa térrea" é, por definição, de um local só.
5. **A aba Matriz já mostra atividade × pavimento** (% e cor por célula), mas **só para ler**.
6. **O Cronograma atual é uma árvore** etapa → atividade → local. Num prédio 7+ com 11 pavimentos são cerca de 300 linhas, e lançar avanço andar por andar ali é lento.

## Proposta de estrutura da tela

### A. Duas visões no Cronograma, com o mesmo rascunho e o mesmo Salvar

1. **"Por andar" (grade de lançamento)**, a visão principal para lançar avanço:
   - Linhas = atividades, agrupadas por etapa (recolhíveis). Colunas = pavimentos, de baixo para cima ou de cima para baixo, mais uma coluna "Obra toda" para as atividades que não são por andar.
   - Célula = % do item daquele andar, **editável** (digita e vai para o rascunho), com a cor da saúde e preenchimento proporcional ao %. Célula vazia (cinza) = a atividade não existe naquele andar (ex.: elevador só na casa de máquinas).
   - Cabeçalho da coluna com o % do andar e um selo de saúde. Rodapé da linha com o % da atividade.
   - Atalhos: clicar no cabeçalho da etapa num andar marca "etapa concluída neste andar" (100% em todas as atividades daquela etapa naquele andar), e a coluna pode ser fixada (sticky) ao rolar.
   - É a matriz que já existe, só que editável e dentro do Cronograma. A aba Matriz deixa de existir ou vira só leitura.
2. **"Por etapa" (Gantt)**, a visão de prazo de hoje: datas, duração, predecessoras e baseline, com **filtro de andar** (chips "Todos | Térreo | 1º | ..."). Escolhendo um andar, a árvore mostra só os itens daquele andar e os de "obra toda", ficando um Gantt do andar.

### B. Definir o que é por andar na própria obra

- Na visão "Por andar", cada atividade ganha um botão para alternar entre **"obra toda"** e **"por andar"**:
  - **Obra toda → por andar:** cria um item por pavimento (valor dividido igualmente ou proporcional, datas copiadas e % copiado).
  - **Por andar → obra toda:** junta os itens em um só (valor somado, datas = span, % = média ponderada).
- Impacto na baseline inicial: os itens novos não existem na baseline. A régua passa a usar o span da atividade antiga para eles. **Isso precisa de uma regra; ver a decisão 2.**

### C. Corrigir os padrões do modelo

- Sobrado: passar 5 Esquadrias, 6 Vidros, 14 Acabamentos e 18 Louças para "por andar". Vale para obras novas; as existentes usariam o B.

### D. Pavimentos editáveis depois de criada a obra

- Adicionar ou remover pavimento numa obra existente, gerando os itens por andar. Hoje isso só é possível no Nova obra.

## Ordem sugerida

1. A1 (grade por andar editável) → maior ganho no lançamento.
2. C (padrões do sobrado) → barato.
3. A2 (filtro de andar no Gantt).
4. B (alternar por andar/obra toda na obra) → mais delicado por causa da baseline.
5. D (pavimentos depois de criada).

## Decisões do Otavio (11/11)

| Ponto | Decisão |
| --- | --- |
| Forma de lançar | **Grade por andar + Gantt** (A1 + A2). A aba Matriz sai: a grade a substitui. |
| Obra muda o que é por andar | **Sim, com botão na atividade** (B). Os itens novos herdam a baseline da atividade original. |
| Padrões do sobrado | **Sim**: 5 Esquadrias, 6 Vidros, 14 Acabamentos e 18 Louças passam a ser por andar (C). |
| Pavimentos depois de criada | **Sim, mas depois** (D, última fase). |

## Execução

- Leva 1: A1 (grade editável) + C (modelo do sobrado) + A2 (filtro de andar no Gantt).
- Leva 2: B (alternar obra toda ↔ por andar, com baseline herdada).
- Leva 3: D (pavimentos em obra existente).
