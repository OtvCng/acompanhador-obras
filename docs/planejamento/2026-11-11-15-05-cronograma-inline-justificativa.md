# Cronograma inline + justificativa acima de 5 dias úteis

Criado em 11/11/2026, 15:05.

## Pedido do Otavio

Tirar os botões de modo ("Editar datas", "Lançar avanço") e deixar o cronograma editável direto na tabela. Toda alteração é salva por um botão de salvar no canto superior direito. Alteração de data de etapa ou atividade acima de 5 dias úteis exige justificativa. A baseline inicial fica guardada para comparação.

## Decisões (11/11)

| Ponto | Decisão |
| --- | --- |
| Régua dos 5 d.u. | **Contra a baseline inicial** (v1). Pega o desvio acumulado. |
| Baseline | **A inicial é fixa.** O atraso é sempre medido contra ela. Não se criam mais v2, v3...; as justificativas vão para um **histórico de alterações**. |
| Quando a inicial é gravada | **No primeiro save do cronograma**, sem justificativa (obra sem baseline). |

## Regras

1. Campos inline: datas, duração e predecessoras para **diretor/engenheiro**; % realizado para **todos** os perfis que veem a obra (como no Campo).
2. Um só botão "Salvar" fixo no canto superior direito. Ele aparece quando há alteração e salva datas, predecessoras e avanços de uma vez. "Descartar" volta tudo.
3. Justificativa: uma etapa ou atividade (span dos seus itens) cujo início ou fim **mudou neste save** e ficou a **mais de 5 dias úteis** da baseline inicial. Isso inclui as etapas empurradas pelas predecessoras. Uma justificativa por save (mín. 5 caracteres), que vale para a lista exibida.
4. Item novo, sem baseline, não entra na régua.
5. Sem baseline: o save grava as datas e congela a v1 logo em seguida. Não pede justificativa.
6. `baselineVigente()` passa a devolver a **v1**. Obras que já tinham v2+ (exemplo do prédio) passam a medir contra a v1; as versões antigas ficam visíveis como histórico.
7. A API **recusa** (400) um PUT que precisaria de justificativa e não traz uma, e recusa criar baseline v2+.

## Implementação

- `shared/justificativa.ts`: `difDiasUteis`, `desviosParaJustificar(antes, depois, limite = 5)`, tipo `AlteracaoCronograma`; `Obra.alteracoes?`. Com testes.
- API: tabela `alteracoes_cronograma` (migration 0004), leitura no repo, PUT com `justificativaAlteracao` opcional (validação e registro no servidor), bloqueio da v2+ em `POST /baselines`.
- Store: `atualizarObra(obra, { justificativa })`.
- Tela: remover os modos, os diálogos de congelar/replanejar e a barra inferior; adicionar o botão fixo, o diálogo de justificativa, o card "Histórico de alterações" e "Baseline inicial".
