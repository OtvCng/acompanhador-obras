# MVP do front com dados mock

- **Criado em:** 2026-11-07
- **Autor:** Orquestrador (Claude, terminal Maestro) com o Otavio
- **Status:** em execução

## Objetivo

Validar com o Otavio (e depois com o sogro) o formato do acompanhamento de obras: etapas por tipo de obra, cronograma físico-financeiro, Curva S, SPI e atraso. Sem banco, sem backend.

## Decisões (grill-me, Q1 a Q23, todas aceitas)

| # | Decisão |
|---|---|
| Q1 | Repositório em `C:\Users\Otavi\acompanhador-obras`; pesquisa e contexto em `otavio-vault/projetos/acompanhador-obras` |
| Q2 | Monorepo pnpm + turbo: `apps/web`, `packages/shared` (tipos + motor), `apps/api` reservado |
| Q3 | Mock em memória + `localStorage` (`obras:v1`), com botão "Restaurar dados de exemplo" |
| Q4 | 6 obras fictícias, uma por tipo, em estágios diferentes |
| Q5 | Perfis Diretor / Engenheiro / Encarregado com seletor no topo; encarregado não vê R$ |
| Q6 | Peso da atividade = participação no orçamento |
| Q7 | Realizado financeiro = valor agregado (gastos reais na fase 2) |
| Q8 | Baseline congelada (v1); replanejar gera v2+ com justificativa; atraso contra a baseline vigente |
| Q9 | Dias úteis seg-sex menos feriados nacionais |
| Q10 | Pavimentos tipados (garagem, térreo comercial, tipo, cobertura...) |
| Q11 | Apontamento: item + %, data, observação e foto (fake) opcionais |
| Q12 | Telas: Painel, Obras, Detalhe (Visão geral, Cronograma, Matriz, Financeiro, Apontamentos), Nova obra, Campo (mobile), Modelos |
| Q13 | Deploy só documentado (Dockerfile, compose, Coolify) |
| Q14 | Planejado proporcional a dias úteis (não binário como no prya) |
| Q15 | SPI: >1,00 adiantada; ≥0,95 no prazo; 0,85-0,94 atenção; <0,85 atrasada; cinza não iniciada; alerta extra se desvio >10 pp (Caixa) |
| Q16 | Prya só como referência; código escrito do zero; nada de marca NTT/Prya |
| Q17 | EAP nível 1 = 20 itens Caixa (COT PF v33) |
| Q18 | 6 tipos: casa térrea, geminadas, sobrado, prédio 3-6, prédio 7+, comercial térreo/galpão |
| Q19 | Wizard distribui orçamento pelo ponto médio das faixas Caixa (estimativa) com alerta fora da faixa |
| Q20 | Durações padrão marcadas NÃO CONFIRMADO até validação |
| Q21 | Nome provisório "Acompanhador de Obras", marca neutra |
| Q22 | Git local, sem remoto |
| Q23 | Terminais Fundação, Telas-Gestão, Telas-Campo; Escavador revisa |

## Fontes

- Pesquisa: `otavio-vault/projetos/acompanhador-obras/pesquisa/2026-11-07-etapas-por-tipo-de-obra.md`
- Mapa do prya (só referência): `otavio-vault/projetos/acompanhador-obras/pesquisa/2026-11-07-mapa-prya-reaproveitamento.md`

## Contratos (não mudar sem combinar na nota "Status- Acompanhador de Obras")

- `packages/shared/src/types.ts`: modelo de dados
- `packages/shared/src/calculo.ts`: assinaturas do motor
- `packages/shared/src/modelos.ts`: EAP, modelos, `gerarObra`, `congelarBaseline`
- `apps/web/src/store/index.tsx`: hooks `useObras`, `useObra`, `useObrasVisiveis`, `podeVerValores`

## Posse de arquivos

| Terminal | Arquivos |
|---|---|
| Fundação | `packages/shared/**` (corpos + testes), `apps/web/src/store/**`, `apps/web/src/data/**` (seed) |
| Telas-Gestão | `apps/web/src/components/layout/**`, `components/ui/**`, `components/charts/**`, `pages/PainelPage.tsx`, `pages/ObrasPage.tsx`, `pages/ObraDetalhePage.tsx`, `pages/obra/**` |
| Telas-Campo | `pages/NovaObraPage.tsx`, `pages/CampoPage.tsx`, `pages/ModelosPage.tsx`, `pages/nova-obra/**`, `pages/campo/**`, `pages/modelos/**`, `components/campo/**` |
| Orquestrador | `App.tsx`, `main.tsx`, `docs/**`, Docker/compose |

`components/ui/**` pertence à Telas-Gestão. A Telas-Campo pode **criar** componentes novos lá, mas não edita os existentes; o que precisar mudar ela pede pela nota.

## Regras para todos

- Português com acentuação correta em todo texto de UI. Sem travessão (—) em strings de UI.
- Nada de `alert/confirm/prompt`: usar Dialog.
- Nenhum dado inventado apresentado como real: estimativas aparecem marcadas ("estimativa", "NÃO CONFIRMADO").
- Nenhum arquivo copiado do prya; ele é só referência visual.
- Commit local por entrega (`git add` só dos próprios arquivos), mensagem em pt-BR.
- `pnpm -r typecheck` verde antes de dizer que terminou.

## Fases

1. Orquestrador: esqueleto, contratos, dev server em `http://127.0.0.1:5180`, portal "App Obras". ✅
2. Fundação: motor + modelos + store + seed (as telas já podem andar em cima dos stubs).
3. Telas-Gestão e Telas-Campo em paralelo.
4. Revisão (Escavador) + integração + build + handover.
