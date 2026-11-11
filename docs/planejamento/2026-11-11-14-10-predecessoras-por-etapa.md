# Predecessoras por etapa no Cronograma

Criado em 11/11/2026, 14:10.

## Objetivo

Garantir que o cronograma siga uma sequência construtiva coerente, com dependências entre **etapas** (não entre atividades).

## Decisões do Otavio (11/11)

| Ponto | Decisão |
| --- | --- |
| Efeito de mudança de data | **Empurra sozinho**: as sucessoras são reprogramadas automaticamente. |
| Tipo de ligação | **Término→início puro**: a etapa só começa no dia útil seguinte ao fim de todas as predecessoras. Sem folga e sem sobreposição. |
| Obras existentes | **Começam vazias**: nenhuma predecessora até alguém cadastrar. Nenhuma data muda sozinha no deploy. |

## Regras

1. Cada etapa da obra tem uma lista `predecessoras` (códigos de etapa da mesma obra). Não pode haver autorreferência, código inexistente nem ciclo.
2. Restrição: o início da etapa (primeiro início entre seus itens) ≥ dia útil seguinte ao maior fim entre as predecessoras.
3. A reprogramação **só empurra para frente**. Se a predecessora termina antes, a sucessora não é puxada (mantém a escolha manual).
4. Empurrar uma etapa desloca **todos os itens dela** pelo mesmo número de dias úteis, mantendo duração e espaçamento interno. Em cascata, na ordem topológica.
5. Etapa **já iniciada** (algum item com avanço > 0) não é deslocada: obra real não volta no tempo. Se ela violar a sequência, aparece um alerta na linha da etapa.
6. A reprogramação acontece no modo **Editar datas** (rascunho): o usuário vê antes de salvar. Vale o fluxo atual de "Salvar datas atuais" e "Replanejar" (baseline).

## Implementação

- `packages/shared`: `EtapaObra.predecessoras?: number[]`, e o novo `predecessoras.ts` com validação (ciclo, inexistente, autorreferência), ordem topológica, reprogramação e violações. Com testes.
- `apps/api`: coluna `predecessoras integer[] not null default '{}'` em `etapas_obra` (migration 0003), leitura e gravação no repo, e validação no zod chamando a validação do shared.
- `apps/web` (AbaCronograma):
  - Coluna/selo "após X, Y" na linha da etapa.
  - No modo Editar datas, um botão na etapa abre a escolha das predecessoras, sem mostrar opções que criariam ciclo.
  - Toda mudança de data, duração ou predecessora roda a reprogramação no rascunho, e um aviso informa quantas etapas foram empurradas.
  - Alerta para etapa iniciada que viola a sequência.

## Fora do escopo (por ora)

- Folga/lag e ligação início→início.
- Puxar sucessoras para trás quando a predecessora adianta.
- Predecessoras entre atividades na obra (continuam só no modelo, usadas na geração).
- Setas de dependência desenhadas no Gantt.
