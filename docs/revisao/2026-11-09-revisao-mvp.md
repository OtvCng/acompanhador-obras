# Revisão do MVP (front mock)

- **Data:** 2026-11-09
- **Revisor:** terminal Revisor (Claude), portal "Portal Revisor"
- **Commit revisado:** comecei em `3aa9d1f` com 8 arquivos de tela modificados e não commitados. Durante a revisão essas mudanças entraram em `c35c87b`, `aca17cc` e `a9a0b71`. O dev server (HMR) serviu o working tree, então o que testei no navegador corresponde, no código do app, a **`a9a0b71`**. As linhas de código citadas abaixo são de `a9a0b71`.
- **Typecheck:** `pnpm -r typecheck` verde em `a9a0b71`. Não rodei os testes (`vitest`).

## Resumo

Não há código copiado do prya. A única coincidência literal é o algoritmo de Páscoa de Meeus/Jones/Butcher, que é público e aparece igual em qualquer referência. As telas seguem bem o estilo das referências: sidebar escura, topbar, KPIs com ícone, cards com faixa lateral de saúde, abas com ícone, Curva S com linha "hoje". Todas as regras do projeto passaram na varredura: pt-BR acentuado, nenhum travessão na UI, nenhum `alert/confirm/prompt`, estimativas marcadas, encarregado sem R$ e sem Nova obra. Também funcionaram: as 6 obras nos estados esperados, o apontamento no campo refletindo no painel, o replanejamento gerando v3 e o wizard criando obra.

Total: **0 bloqueantes, 4 importantes, 11 menores.**

## Achados

### 1. Gantt do Cronograma cortado à direita em 1440 px (importante)
- **Tela:** `/obras/:id?aba=cronograma`, todas as obras. Arquivo: `apps/web/src/pages/obra/AbaCronograma.tsx:374` (`min-w-[1100px]`).
- **O que está errado:** a coluna "Etapa / atividade / local" ocupa cerca de 570 px. Com isso, a tabela (1204 px) passa da área do card (1135 px) e ganha rolagem horizontal interna. A coluna do Gantt fica com cerca de 290 px. Ao abrir a aba, os meses finais e a linha "hoje" ficam fora da vista no galpão (nov/dez) e no prédio 7+, e no prédio 3-6 a tabela vai até x=1559. Quem abre a aba não vê "onde estamos hoje", que é a informação principal.
- **Como reproduzir:** viewport 1440x900, `/obras/obra-comercial?aba=cronograma`. O cabeçalho do Gantt termina em "out/26" e o marcador "hoje" está escondido.
- **Sugestão:** limitar a largura da coluna de nome (truncate + title) ou rolar o Gantt até "hoje" ao montar.
- **Dono:** Telas-Gestão.

### 2. Faixa Caixa arredondada para inteiro gera "1% a 1%" e "4% a 4%" (importante)
- **Telas:** Visão geral > Alertas e Financeiro > coluna "Faixa Caixa". Arquivos: `apps/web/src/pages/obra/AbaVisaoGeral.tsx:54` e `apps/web/src/pages/obra/AbaFinanceiro.tsx:125` (`formatPct(..., 0)`).
- **O que está errado:** as faixas reais têm duas casas (ex.: Acabamentos 1,01 a 1,38; Hidráulicas 3,63 a 4,27; `packages/shared/src/modelos.ts:40-61`). Com zero casas aparecem "Acabamentos: 0,9% do orçamento. Fora da faixa (1% a 1%)" e "Instalações hidráulicas: 3,0%, fora da faixa (4% a 4%)". Parece erro de dado. O wizard e Modelos já mostram uma casa ("1,0% a 1,4%"), então as telas ficam inconsistentes entre si.
- **Como reproduzir:** `/obras/obra-comercial?aba=visao-geral`, rolar até "Alertas".
- **Dono:** Telas-Gestão.

### 3. Seed do galpão: os 32% da supraestrutura empurram mais 8 etapas para fora da faixa (importante)
- **Tela:** `/obras/obra-comercial`, Visão geral > Alertas e Financeiro. Dados: `apps/web/src/data/seed.ts` (galpão), com `ajustarValorEtapa` mantendo o total.
- **O que está errado:** o esperado era "supraestrutura fora da faixa". Como o total foi mantido, as outras etapas encolheram, e os alertas listam 9 etapas fora da faixa: Supraestrutura 32%, Revestimentos internos 6,1%, Revestimentos externos 3,5%, Pisos 7,5%, Acabamentos 0,9%, Elétricas 3,3%, Hidráulicas 3,0%, Esgoto 3,0%, Louças 3,4%. Na demonstração, o caso didático (uma etapa editada fora da faixa) se perde no meio do ruído.
- **Como reproduzir:** Restaurar dados de exemplo e abrir a Visão geral do galpão.
- **Sugestão:** no seed, editar a supraestrutura com `manterTotal=false`, ou subir o orçamento total junto.
- **Dono:** Fundação.

### 4. Campo: "Em andamento 0" enquanto 7 atividades estão dentro do prazo de execução (importante)
- **Tela:** `/campo/obra-comercial` (390x844). Arquivo: `apps/web/src/pages/campo/CampoObra.tsx:191` (agrupamento `grupos.andamento`).
- **O que está errado:** a seção "Em andamento" mostra "0 · Nada em andamento neste local." As atividades que estão rodando hoje (ex.: 19.01 Pátio, 27/10 a 10/11, 35%; 10.01 Forro, 06/11 a 12/11) caem todas em "Atrasados". Para o encarregado, a primeira coisa que aparece diz que não há nada em execução na obra. A Visão geral da mesma obra lista 3 etapas em andamento.
- **Como reproduzir:** usuário Lúcia Teste, Campo > Galpão Comercial Exemplo.
- **Sugestão:** manter em "Em andamento" o que está dentro da janela de datas (com selo "atrasado" se estiver abaixo do previsto) e deixar em "Atrasados" só o que já passou do fim.
- **Dono:** Telas-Campo.

### 5. Nomes de atividade cortados no campo (menor)
- **Tela:** `/campo/:obraId`. Arquivo: `apps/web/src/pages/campo/CampoObra.tsx:19` (`truncate`).
- **O que está errado:** em 390 px aparecem "Ferragens (dobradiças, fe…", "Rodapés, soleiras e peitor…", "Impermeabilização de área…". No celular não há hover/title para ler o resto. Duas linhas (`line-clamp-2`) resolveriam.
- **Dono:** Telas-Campo.

### 6. Topbar no celular com alvos de toque de 32 px (menor)
- **Tela:** `/campo` e `/campo/:obraId` em 390x844. Arquivo: `apps/web/src/components/layout/Topbar.tsx:39` (Abrir menu, p-1.5 = 32x32), `:52`/`:59` (seletor h-8) e `:75` (Restaurar `size="sm"`, 42x32).
- **O que está errado:** todos os botões das páginas do campo têm 44 px ou mais (medido: atalhos 65x56, ±1% 44x44, Salvar 219x48). Os da topbar, que aparecem nas mesmas telas, ficam abaixo de 44 px. O nome no seletor de usuário também aparece cortado ("Roberto Fictício (Dire…").
- **Dono:** Telas-Gestão.

### 7. Encarregado acessa `/modelos` pelo endereço (menor)
- **Tela:** `/modelos` e `/modelos/:tipo` com Lúcia Teste. Arquivo: `apps/web/src/App.tsx:23-24` e `apps/web/src/pages/ModelosPage.tsx` (sem guarda de perfil).
- **O que está errado:** a sidebar esconde Modelos e `/obras/nova` mostra "Cadastro de obras restrito", mas `/modelos` abre em modo leitura ("Seu perfil vê os modelos só para leitura"). Não aparece R$ (conferido). A regra Q5/briefing diz que o encarregado não vê Modelos. Ou se bloqueia como em Nova obra, ou se registra a decisão na nota.
- **Dono:** Telas-Campo.

### 8. Obra criada com baseline aparece "Não iniciada" e "Em andamento" ao mesmo tempo (menor)
- **Tela:** detalhe da obra criada pelo wizard com início no futuro. Arquivo: `packages/shared/src/modelos.ts:573` (`congelarBaseline` muda `planejamento` para `em_andamento`).
- **O que está errado:** criei "Sobrado Teste Revisor" com início 09/11/2026 (Hoje = 07/11) e "Salvar e congelar baseline v1". O cabeçalho mostra os selos "Não iniciada" e "Em andamento" lado a lado.
- **Dono:** Fundação (regra) ou Telas-Gestão (rótulo do status).

### 9. Texto da Matriz fala em "prédio subindo pavimento a pavimento" também para geminadas e sobrado (menor)
- **Arquivo:** `apps/web/src/pages/obra/AbaMatriz.tsx:74`.
- **O que está errado:** nas geminadas as colunas são "Casa 1..4", mas a legenda fala do ciclo do prédio. O texto deveria variar com o tipo de desdobramento.
- **Dono:** Telas-Gestão.

### 10. Concordância: "duração NÃO CONFIRMADO" e "1 pavimentos" (menor)
- **Arquivos:** `apps/web/src/pages/nova-obra/PassoRevisao.tsx:56` ("48 de 48 atividades usam duração NÃO CONFIRMADO"), `apps/web/src/pages/modelos/ModeloDetalhe.tsx:89` ("56 durações NÃO CONFIRMADO"), `apps/web/src/pages/nova-obra/EditorPavimentos.tsx:43` ("Gerar 1 pavimentos tipo").
- **O que está errado:** o selo "NÃO CONFIRMADO" pode ficar como marca fixa, mas dentro da frase deveria ser "duração não confirmada" ou "durações não confirmadas". Também falta o singular para N=1.
- **Dono:** Telas-Campo.

### 11. Coluna "Fonte" em Modelos mostra a URL crua, cortada (menor)
- **Arquivo:** `apps/web/src/pages/modelos/ModeloDetalhe.tsx:153` e `:257`.
- **O que está errado:** todas as linhas mostram "Caixa COT PF v33, Anexo III, faixa recomendada (https:/…". A URL fica no meio do texto e o corte acontece justo nela. Melhor exibir o texto curto e a URL como link/ícone.
- **Dono:** Telas-Campo (exibição) ou Fundação (formato do campo `fonte`).

### 12. "No prazo" e "Adiantada" com o mesmo verde (menor)
- **Telas:** painel (Distribuição por saúde), legenda da Matriz, badges. Arquivo: `apps/web/src/styles/index.css:12` (só `--color-saude-verde`).
- **O que está errado:** na barra de distribuição do painel as faixas "No prazo" e "Adiantada" ficam lado a lado com a mesma cor e só se distinguem pelo rótulo. Se for intencional (régua do prya), ignorar. Senão, usar um verde mais escuro ou azul-esverdeado para "Adiantada".
- **Dono:** Telas-Gestão.

### 13. Desvio de -0,1 pp em vermelho em obra "No prazo" (menor)
- **Tela:** `/obras` (lista). Edifício: SPI 1,00, desvio "-0,1 pp" em vermelho. Torre: SPI 0,99, "-1,0 pp" em vermelho.
- **O que está errado:** vermelho para qualquer desvio negativo assusta numa obra no prazo. A cor do desvio poderia seguir a faixa de saúde.
- **Dono:** Telas-Gestão.

### 14. Campo lista primeiro a obra concluída (menor)
- **Tela:** `/campo` como diretor: a primeira obra é "Residência Exemplo Azambuja · Concluída".
- **O que está errado:** no campo interessa o que está em execução. Ordenar concluídas por último ou recolhê-las.
- **Dono:** Telas-Campo.

### 15. Carnaval (segunda e terça) tratado como feriado nacional (menor)
- **Arquivo:** `packages/shared/src/calculo.ts:61-62`.
- **O que está errado:** Carnaval é ponto facultativo, não feriado nacional em lei. Q9 diz "feriados nacionais". Pode ser uma escolha prática para obra, mas então convém marcar no código/UI como decisão (ou NÃO CONFIRMADO) até o sogro validar se a construtora para no Carnaval.
- **Dono:** Fundação.

## Cópia do prya

Método: script Node que normaliza espaços, ignora linhas triviais (fechamento de tag, `}`, imports) e compara janelas de 5 e de 3 linhas consecutivas de `apps/web/src/**` e `packages/shared/src/**` contra 1604 arquivos únicos (`.ts/.tsx/.js/.jsx/.mjs/.css`) de `C:/Users/Otavi/prya-fork` (incluindo todos os `wt-*`, sem `node_modules`, `dist`, `.git`). Também procurei linhas longas (70+ caracteres) idênticas. Para cada arquivo de `components/ui` medi a porcentagem de linhas iguais ao homônimo do prya.

| # | Nosso arquivo | prya-fork | O que é | Avaliação |
|---|---|---|---|---|
| C1 | `packages/shared/src/calculo.ts:37-53` (`pascoa`) | `prya_fork/apps/api/src/utils/br-holidays.ts:51-67` (`easterSunday`) | 13 linhas de aritmética idênticas (`const d = Math.floor(b / 4)` ... `% 31) + 1`) | Algoritmo público de Meeus/Jones/Butcher, com as variáveis `a..m` da forma canônica (Wikipedia e outras). O resto do arquivo é diferente: nomes, formato das datas, Carnaval segunda+terça contra só terça no prya, sem descrições. **Não é cópia do prya.** Se quiserem afastar qualquer dúvida, basta citar a fonte pública no comentário. |
| C2 | `apps/web/src/components/ui/select.tsx:64` | `prya_fork/apps/web/src/app/components/ui/select.tsx:118` | `<span className="absolute right-2 flex size-3.5 items-center justify-center">` | Linha do template shadcn/Radix. 18 de 47 linhas iguais (38%), todas tags `SelectPrimitive.*` e `className={cn(`, o que é estrutura obrigatória do Radix. Não é cópia literal do arquivo. **Esperado.** |
| C3 | `apps/web/src/components/campo/formatos.ts:3` | `prya_fork/apps/web/src/app/components/project/ProjectAuditLog.tsx:77` | `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | Construção padrão da API Intl. **Não é cópia.** |

Outros resultados: os demais componentes de `components/ui` têm de 0% a 25% de linhas iguais ao prya (badge 0%, card 0%, table 0%, button 4%, tabs 11%, dialog 17%, tooltip 25%), sempre imports e tags Radix. Nada em charts, páginas, store ou seed. Nenhuma ocorrência de "prya", "NTT" ou marca na UI. A única menção é um comentário interno: `packages/shared/src/calculo.ts:149` ("régua SPI do prya"), que documenta a origem da regra Q15 e não é código copiado.

**Conclusão: nenhuma cópia de código do prya encontrada.**

## Paridade visual (1440x900 e 390x844)

- **Painel** (`/`) contra `painel-kpis-1280.png`, `painel-1280.png`: mesma linguagem (sidebar #0f172a, item ativo azul, KPIs com ícone em quadrado colorido, cards com borda lateral de saúde). Marca neutra "Acompanhador de Obras". Sem overflow. O prya tem barra de filtros no painel e o nosso não tem, mas a lista Obras tem (aceitável).
- **Obras** (`/obras`): tabela com busca e 3 filtros, barra realizado x planejado com marcador, badges de saúde. A referência `projetos-5cards.png` é um print de erro (429) e não serviu de comparação.
- **Detalhe** contra `01-visao-geral-curva-s.png`: cabeçalho com seta, selos e barra de progresso colorida embaixo, abas com ícone, Curva S com previsto tracejado, realizado sólido e linha "hoje". Paridade boa. Cronograma: ver achado 1. Matriz: rolagem horizontal com a coluna de atividade sticky (ok no prédio 7+). Financeiro: tabela por etapa com selo "estimativa" e gráficos (4 gráficos, séries renderizadas).
- **Nova obra** e **Modelos**: consistentes com o resto. Rodapé do wizard fixo com Voltar/Continuar.
- **Campo** (390x844): cards grandes, sem overflow horizontal. A folha inferior tem atalhos de 25 em 25%, ajuste ±1%, observação, foto e Salvar.
- **Não verifiquei** por imagem: `curva-s-grafico.png`, `v054-dashboard.png`, `scurve-fases-1.png` (não abri). Também não consegui capturar a folha inferior do campo em imagem (o html2canvas não pega o portal do Dialog). Ela foi verificada pelo snapshot de acessibilidade e pelas medidas.
- **Observação de método:** o `maestri portal screenshot` falhou ("page is not rendering"). As capturas foram feitas com html2canvas-pro injetado por `evaluate`. Esse renderizador desenha sombras transparentes como bordas cinza grossas. Isso é artefato da captura, não da tela (conferido no computed style: `shadow-sm` normal).

## Regras do projeto

| Regra | Resultado |
|---|---|
| pt-BR com acentuação | Ok. Varredura de palavras comuns sem acento em todas as telas: nada (exceto o falso positivo "versao" dentro de uma URL). Ver achado 10 (concordância). |
| Sem travessão (—) na UI | Ok. `grep` no código e varredura do `innerText` em todas as telas: zero. |
| Sem alert/confirm/prompt | Ok. `grep` zero. Restaurar e Replanejar usam Dialog. |
| Estimativas marcadas | Ok. Selos "estimativa" no Financeiro, wizard e Modelos. "NÃO CONFIRMADO" em todas as atividades do Cronograma e nas durações da Revisão do wizard. Fim previsto do wizard com selo "estimativa". Fotos "ilustrativas (dados de exemplo)". |
| Encarregado sem R$ | Ok. Com Lúcia Teste: painel, lista, detalhe (visão geral, cronograma, matriz, apontamentos) e campo com **zero** "R$". A aba Financeiro some, e `?aba=financeiro` cai na Visão geral. |
| Encarregado sem Nova obra/Modelos | Nova obra ok (sidebar oculta, rota bloqueada com mensagem). Modelos oculto na sidebar, mas acessível por URL (achado 7). |
| Toque ≥ 44 px no campo | Ok nas páginas do campo (nenhum controle abaixo de 44 px em `main` e na folha). Na topbar não (achado 6). |

## Funcional

Executado no Portal Revisor depois de "Restaurar dados de exemplo", com Hoje = 07/11/2026 (`HOJE_SEED`).

- **6 obras:** casa Concluída (100%, SPI 1,00); geminadas Atrasada, SPI 0,74, -20,1 pp, ícone Alerta Caixa; sobrado Adiantada, SPI 1,14 (a nota diz 1,10, mas o seed foi ajustado depois, ver `3aa9d1f`); prédio 3-6 No prazo com Baseline v2 e justificativa visível no Cronograma; prédio 7+ No prazo, SPI 0,99; galpão Atenção, SPI 0,90, com Supraestrutura 32% fora da faixa (12% a 18%). **Todos conferem.**
- **Apontamento no campo refletindo no painel:** como Lúcia, lancei 19.01 Pátio de 35% para 75% com observação. Apareceu o toast "Apontamento salvo". O galpão foi de 75,1% para 75,3% na lista/painel e de 62 para 63 lançamentos na aba Apontamentos. **Ok.**
- **Replanejar:** prédio 3-6 > Cronograma > Replanejar. O botão "Gerar nova versão" fica desabilitado sem justificativa. Com justificativa foi gerada a **Baseline v3**; o `localStorage` tem v1, v2 e v3 com as justificativas. **Ok.**
- **Wizard:** Sobrado, 2 pavimentos, R$ 900.000,00, início 09/11/2026. Aviso de sábado na data padrão, soma conferida 100%, revisão com cronograma por etapa. "Salvar e congelar baseline v1" criou `/obras/obra-mw9j30330`. **Ok** (ver achado 8).
- **Console:** `logs-start` ativo durante toda a navegação. **Nenhum erro ou aviso capturado.**
- **Não verifiquei:** "Editar datas" antes do Replanejar, edição de valor no Financeiro, edição e "Restaurar modelo padrão" em Modelos, foto no apontamento, troca da data "Hoje", menu lateral em < lg.

Nota: ao final, cliquei de novo em "Restaurar dados de exemplo" no Portal Revisor para apagar a obra de teste, a v3 e o apontamento de teste.
