/**
 * Levas 2 e 3: estrutura por andar editável na obra.
 * Contrato: docs/planejamento/2026-11-11-17-30-levas-2-3-estrutura-por-andar.md
 *
 * Todas as funções são puras: devolvem uma Obra nova e não mexem na de entrada.
 * As quatro de estrutura já devolvem `baselines[0]` sincronizada (via sincronizarBaselineEstrutura).
 */
import { MODELOS, ratear } from './modelos';
import type { Atividade, Baseline, ISODate, ItemAtividade, Local, Obra, TipoPavimento } from './types';

export type NovoId = (prefixo: string) => string;

type ItemBase = Baseline['itens'][string];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const centavos = (v: number) => Math.round(v * 100);
const somaValores = (vs: number[]) => vs.reduce((s, v) => s + centavos(v), 0) / 100;

/** Regra de valor: divide `total` igualmente em `n` partes, arredondado em centavos, com o resto no último. */
function dividirIgual(total: number, n: number): number[] {
  if (n <= 0) return [];
  const c = centavos(total);
  const base = Math.trunc(c / n);
  const out = Array.from({ length: n }, () => base);
  out[n - 1] += c - base * n;
  return out.map((x) => x / 100);
}

function acharAtividade(obra: Obra, atividadeId: string): Atividade {
  for (const e of obra.etapas) for (const a of e.atividades) if (a.id === atividadeId) return a;
  throw new Error(`Atividade ${atividadeId} não encontrada nesta obra.`);
}

const minData = (ds: ISODate[]) => ds.reduce((a, b) => (b < a ? b : a));
const maxData = (ds: ISODate[]) => ds.reduce((a, b) => (b > a ? b : a));

/** Aplica o avanço (sincronizarAvancoEstrutura) e a baseline sincronizada (antes → depois) em `depois.baselines[0]`. */
function comBaseline(antes: Obra, depois: Obra): Obra {
  const d = sincronizarAvancoEstrutura(antes, depois);
  const b = sincronizarBaselineEstrutura(antes, d);
  if (!b) return d;
  return { ...d, baselines: [b, ...d.baselines.slice(1)] };
}

function rotuloLocal(l: Local): string {
  return l.tipo === 'unidade' ? `a unidade "${l.nome}"` : `o andar "${l.nome}"`;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
/** Locais de andar (tudo que não é tipo 'obra'), ordenados por `ordem`. */
export function locaisDeAndar(obra: Obra): Local[] {
  return obra.locais.filter((l) => l.tipo !== 'obra').sort((a, b) => a.ordem - b.ordem);
}

/** true se a atividade tem item em algum local de andar. */
export function atividadePorAndar(obra: Obra, atividadeId: string): boolean {
  const andares = new Set(locaisDeAndar(obra).map((l) => l.id));
  return acharAtividade(obra, atividadeId).itens.some((i) => andares.has(i.localId));
}

// ---------------------------------------------------------------------------
// Leva 2
// ---------------------------------------------------------------------------
/** Leva 2: "obra toda" → um item por andar. `localIds` vazio/ausente = todos os andares. */
export function dividirPorAndar(obra: Obra, atividadeId: string, novoId: NovoId, localIds?: string[]): Obra {
  const nova = clonar(obra);
  const ativ = acharAtividade(nova, atividadeId);
  if (ativ.itens.length !== 1) throw new Error('Só dá para dividir uma atividade que está em "obra toda" (um item só).');
  const orig = ativ.itens[0];
  const localOrig = nova.locais.find((l) => l.id === orig.localId);
  if (!localOrig || localOrig.tipo !== 'obra') throw new Error('Só dá para dividir uma atividade que está em "obra toda".');
  let andares = locaisDeAndar(nova);
  if (localIds?.length) andares = andares.filter((l) => localIds.includes(l.id));
  if (andares.length === 0) throw new Error('Escolha pelo menos um andar para dividir a atividade.');

  const valores = dividirIgual(orig.valorOrcado, andares.length);
  ativ.itens = andares.map((l, k) => ({
    ...orig,
    id: k === 0 ? orig.id : novoId('item'),
    localId: l.id,
    valorOrcado: valores[k],
  }));
  return comBaseline(obra, nova);
}

/** Leva 2: "por andar" → um item só no local "Obra toda" (cria esse local se não existir). */
export function juntarEmObraToda(obra: Obra, atividadeId: string, novoId: NovoId): Obra {
  const nova = clonar(obra);
  const ativ = acharAtividade(nova, atividadeId);
  if (ativ.itens.length === 0) throw new Error('Esta atividade não tem itens para juntar.');
  if (ativ.itens.length === 1 && nova.locais.find((l) => l.id === ativ.itens[0].localId)?.tipo === 'obra') {
    throw new Error('Esta atividade já está em "obra toda".');
  }

  let localObra = nova.locais.find((l) => l.tipo === 'obra');
  if (!localObra) {
    localObra = { id: novoId('local'), nome: 'Obra toda', tipo: 'obra', ordem: -1 };
    nova.locais = [localObra, ...nova.locais];
  }
  const ordemDe = new Map(nova.locais.map((l) => [l.id, l.ordem]));
  const itens = [...ativ.itens].sort((a, b) => (ordemDe.get(a.localId) ?? 0) - (ordemDe.get(b.localId) ?? 0));
  const primeiro = itens[0];

  // Um item só, num andar: volta para "obra toda" mantendo id, datas, % e real (a baseline mantém a entrada).
  if (itens.length === 1) {
    ativ.itens = [{ ...primeiro, localId: localObra.id }];
    return comBaseline(obra, nova);
  }

  // % e início/fim real: preenchidos por sincronizarAvancoEstrutura (mesma regra do servidor).
  ativ.itens = [{
    id: primeiro.id,
    localId: localObra.id,
    inicioPlanejado: minData(itens.map((i) => i.inicioPlanejado)),
    fimPlanejado: maxData(itens.map((i) => i.fimPlanejado)),
    percentual: 0,
    valorOrcado: somaValores(itens.map((i) => i.valorOrcado)),
  }];
  return comBaseline(obra, nova);
}

// ---------------------------------------------------------------------------
// Leva 3
// ---------------------------------------------------------------------------
/** Leva 3: insere um andar na posição `posicao` (0 = mais baixo) e cria os itens das atividades por andar. */
export function adicionarPavimento(
  obra: Obra,
  p: { nome: string; tipoPavimento?: TipoPavimento; tipo: 'pavimento' | 'unidade'; posicao: number },
  novoId: NovoId,
): Obra {
  const nova = clonar(obra);
  const andares = locaisDeAndar(nova);
  const pos = Math.max(0, Math.min(andares.length, Math.trunc(p.posicao)));
  const local: Local = { id: novoId('local'), nome: p.nome, tipo: p.tipo, ordem: pos };
  if (p.tipoPavimento) local.tipoPavimento = p.tipoPavimento;
  const ordenados = [...andares.slice(0, pos), local, ...andares.slice(pos)];
  ordenados.forEach((l, k) => { l.ordem = k; });
  nova.locais = [...nova.locais.filter((l) => l.tipo === 'obra'), ...ordenados];

  const posDe = new Map(ordenados.map((l, k) => [l.id, k]));
  const modelo = MODELOS[nova.tipo];
  for (const e of nova.etapas) for (const a of e.atividades) {
    if (!atividadePorAndar(obra, a.id)) continue;
    if (p.tipo !== 'unidade') {
      const tp = modelo?.atividades.find((m) => m.codigo === a.codigo)?.tiposPavimento;
      if (tp?.length && !(p.tipoPavimento && tp.includes(p.tipoPavimento))) continue;
    }
    const vizinho = vizinhoDoAndar(a.itens, posDe, pos);
    if (!vizinho) continue;
    const novo: ItemAtividade = {
      id: novoId('item'),
      localId: local.id,
      inicioPlanejado: vizinho.inicioPlanejado,
      fimPlanejado: vizinho.fimPlanejado,
      percentual: 0,
      valorOrcado: 0,
    };
    const total = somaValores(a.itens.map((i) => i.valorOrcado));
    const itens = [...a.itens, novo].sort((x, y) => (posDe.get(x.localId) ?? -1) - (posDe.get(y.localId) ?? -1));
    const valores = dividirIgual(total, itens.length);
    itens.forEach((i, k) => { i.valorOrcado = valores[k]; });
    a.itens = itens;
  }
  return comBaseline(obra, nova);
}

/** Item do andar vizinho de baixo mais próximo (se não houver, o de cima mais próximo). */
function vizinhoDoAndar<T extends { localId: string }>(itens: T[], posDe: Map<string, number>, pos: number): T | undefined {
  let baixo: { i: T; p: number } | undefined;
  let cima: { i: T; p: number } | undefined;
  for (const i of itens) {
    const p = posDe.get(i.localId);
    if (p === undefined || p === pos) continue;
    if (p < pos && (!baixo || p > baixo.p)) baixo = { i, p };
    if (p > pos && (!cima || p < cima.p)) cima = { i, p };
  }
  return (baixo ?? cima)?.i;
}

/** Leva 3: motivo de bloqueio, ou null se pode remover. */
export function motivoBloqueioRemocao(obra: Obra, localId: string): string | null {
  const local = obra.locais.find((l) => l.id === localId);
  if (!local) return 'Este local não existe mais na obra.';
  if (local.tipo === 'obra') return 'O local "Obra toda" não pode ser removido.';
  const andares = locaisDeAndar(obra);
  const temItens = obra.etapas.some((e) => e.atividades.some((a) => a.itens.some((i) => i.localId === localId)));
  // Último andar só bloqueia se ainda tiver itens; vazio pode sair (a obra volta a ser de local único).
  if (andares.length <= 1 && temItens) {
    return local.tipo === 'unidade'
      ? 'Não dá para remover a última unidade da obra.'
      : 'Não dá para remover o último andar da obra.';
  }
  const rotulo = rotuloLocal(local);
  const itensDoLocal = new Set<string>();
  for (const e of obra.etapas) for (const a of e.atividades) for (const i of a.itens) {
    if (i.localId !== localId) continue;
    itensDoLocal.add(i.id);
    if (i.percentual > 0) return `Não dá para remover ${rotulo}: a atividade ${a.codigo} ${a.nome} já tem avanço lançado nele.`;
  }
  const apont = (obra.apontamentos ?? []).find((ap) => itensDoLocal.has(ap.itemId));
  if (apont) {
    const a = obra.etapas.flatMap((e) => e.atividades).find((x) => x.itens.some((i) => i.id === apont.itemId));
    return `Não dá para remover ${rotulo}: ${a ? `a atividade ${a.codigo} ${a.nome}` : 'uma atividade'} tem apontamento no histórico nele.`;
  }
  for (const e of obra.etapas) {
    let sobram = 0;
    for (const a of e.atividades) {
      const ficaVazia = a.itens.length > 0 && a.itens.every((i) => i.localId === localId);
      if (!ficaVazia) { sobram++; continue; }
      if ((obra.gastos ?? []).some((g) => g.atividadeId === a.id)) {
        return `Não dá para remover ${rotulo}: a atividade ${a.codigo} ${a.nome} só existe nele e já tem gasto lançado.`;
      }
    }
    if (e.atividades.length > 0 && sobram === 0) {
      return `Não dá para remover ${rotulo}: a etapa ${e.codigo} ${e.nome} ficaria sem nenhuma atividade.`;
    }
  }
  return null;
}

/** Leva 3: remove o andar e os itens dele. Lança Error(motivo) se bloqueado. */
export function removerPavimento(obra: Obra, localId: string): Obra {
  const motivo = motivoBloqueioRemocao(obra, localId);
  if (motivo) throw new Error(motivo);
  const nova = clonar(obra);
  nova.locais = nova.locais.filter((l) => l.id !== localId);
  locaisDeAndar(nova).forEach((l, k) => { l.ordem = k; });

  for (const e of nova.etapas) {
    const total = new Map(e.atividades.map((a) => [a.id, somaValores(a.itens.map((i) => i.valorOrcado))]));
    const mudou = new Set<string>();
    for (const a of e.atividades) {
      const n = a.itens.length;
      a.itens = a.itens.filter((i) => i.localId !== localId);
      if (a.itens.length !== n) mudou.add(a.id);
    }
    const removidas = e.atividades.filter((a) => a.itens.length === 0 && mudou.has(a.id));
    if (removidas.length) {
      const sobram = e.atividades.filter((a) => !removidas.includes(a));
      const extra = somaValores(removidas.map((a) => total.get(a.id)!));
      const partes = ratear(extra, sobram.map((a) => total.get(a.id)!));
      sobram.forEach((a, k) => {
        total.set(a.id, somaValores([total.get(a.id)!, partes[k]]));
        mudou.add(a.id);
      });
      e.atividades = sobram;
    }
    for (const a of e.atividades) {
      if (!mudou.has(a.id)) continue;
      const vs = dividirIgual(total.get(a.id)!, a.itens.length);
      a.itens.forEach((i, k) => { i.valorOrcado = vs[k]; });
    }
  }
  return comBaseline(obra, nova);
}

// ---------------------------------------------------------------------------
// Avanço no PUT
// ---------------------------------------------------------------------------
/**
 * Avanço (percentual, inicioReal, fimReal) dos itens das atividades cujo conjunto de ids mudou entre `antes`
 * e `depois`, derivado só de `antes` (no servidor: o banco). O resto de `depois` não é tocado.
 * - item que já existia: copia o avanço dele em `antes`;
 * - merge (1 item no local 'obra', vindo de ≥ 2): % = média ponderada pelo valorOrcado de ANTES (arredondada),
 *   inicioReal = o menor, fimReal = o maior só se todos tinham;
 * - split (a atividade tinha 1 item em `antes`): item novo copia o avanço do original;
 * - andar novo: 0, sem real.
 */
export function sincronizarAvancoEstrutura(antes: Obra, depois: Obra): Obra {
  const nova = clonar(depois);
  const ativAntes = new Map<string, ItemAtividade[]>();
  for (const e of antes.etapas) for (const a of e.atividades) ativAntes.set(a.id, a.itens);
  const tipoLocal = new Map(nova.locais.map((l) => [l.id, l.tipo]));
  const copiar = (dest: ItemAtividade, src: Pick<ItemAtividade, 'percentual' | 'inicioReal' | 'fimReal'>) => {
    dest.percentual = src.percentual;
    if (src.inicioReal) dest.inicioReal = src.inicioReal; else delete dest.inicioReal;
    if (src.fimReal) dest.fimReal = src.fimReal; else delete dest.fimReal;
  };

  for (const e of nova.etapas) for (const a of e.atividades) {
    const ant = ativAntes.get(a.id) ?? [];
    const mesmo = ant.length === a.itens.length && a.itens.every((i) => ant.some((j) => j.id === i.id));
    if (mesmo) continue;
    const porId = new Map(ant.map((i) => [i.id, i]));
    for (const i of a.itens) {
      const velho = porId.get(i.id);
      const junta = velho && a.itens.length === 1 && tipoLocal.get(i.localId) === 'obra' && ant.length >= 2;
      if (junta) {
        const somaV = ant.reduce((s, x) => s + x.valorOrcado, 0);
        const inicios = ant.map((x) => x.inicioReal).filter((d): d is ISODate => !!d);
        const fins = ant.map((x) => x.fimReal);
        copiar(i, {
          percentual: somaV > 0
            ? Math.round(ant.reduce((s, x) => s + x.percentual * x.valorOrcado, 0) / somaV)
            : Math.round(ant.reduce((s, x) => s + x.percentual, 0) / ant.length),
          inicioReal: inicios.length ? minData(inicios) : undefined,
          fimReal: fins.every((d) => !!d) ? maxData(fins as ISODate[]) : undefined,
        });
      } else if (velho) copiar(i, velho);
      else if (ant.length === 1) copiar(i, ant[0]);
      else copiar(i, { percentual: 0 });
    }
  }
  return nova;
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------
/**
 * Baseline inicial (v1) ajustada à estrutura de `depois`, partindo da baseline de `antes`. null = sem baseline.
 * Usada pelas 4 funções acima (para a tela já mostrar certo) e pela API no PUT (a API NÃO confia na baseline do corpo).
 */
export function sincronizarBaselineEstrutura(antes: Obra, depois: Obra): Baseline | null {
  const b = antes.baselines[0];
  if (!b) return null;

  const ativAntes = new Map<string, { etapa: number; itens: ItemAtividade[] }>();
  for (const e of antes.etapas) for (const a of e.atividades) ativAntes.set(a.id, { etapa: e.codigo, itens: a.itens });
  const ativDepois = new Map<string, { etapa: number; a: Atividade }>();
  for (const e of depois.etapas) for (const a of e.atividades) ativDepois.set(a.id, { etapa: e.codigo, a });

  const totalBase = (itens: ItemAtividade[]) => somaValores(itens.filter((i) => b.itens[i.id]).map((i) => b.itens[i.id].valor));
  const mesmoConjunto = (x: ItemAtividade[], y: ItemAtividade[]) =>
    x.length === y.length && x.every((i) => y.some((j) => j.id === i.id));

  // Total de baseline de cada atividade de `depois` e se ela precisa ser redividida.
  const total = new Map<string, number>();
  const mudou = new Set<string>();
  for (const [id, { a }] of ativDepois) {
    const ant = ativAntes.get(id);
    total.set(id, ant ? totalBase(ant.itens) : 0);
    if (!ant || !mesmoConjunto(ant.itens, a.itens)) mudou.add(id);
  }

  // Atividades que sumiram: o total delas vai, proporcionalmente, para as outras da mesma etapa.
  const removidasPorEtapa = new Map<number, number>();
  for (const [id, { etapa, itens }] of ativAntes) {
    if (ativDepois.has(id)) continue;
    removidasPorEtapa.set(etapa, somaValores([removidasPorEtapa.get(etapa) ?? 0, totalBase(itens)]));
  }
  for (const [etapa, extra] of removidasPorEtapa) {
    if (centavos(extra) === 0) continue;
    const alvo = [...ativDepois].filter(([, v]) => v.etapa === etapa).map(([id]) => id);
    if (!alvo.length) continue;
    const partes = ratear(extra, alvo.map((id) => total.get(id)!));
    alvo.forEach((id, k) => { total.set(id, somaValores([total.get(id)!, partes[k]])); mudou.add(id); });
  }

  const posDe = new Map(locaisDeAndar(depois).map((l, k) => [l.id, k]));
  const tipoLocal = new Map(depois.locais.map((l) => [l.id, l.tipo]));
  const itens: Baseline['itens'] = {};

  for (const [id, { a }] of ativDepois) {
    const ant = ativAntes.get(id);
    if (!mudou.has(id)) {
      for (const i of a.itens) if (b.itens[i.id]) itens[i.id] = { ...b.itens[i.id] };
      continue;
    }
    const entradasAntes = (ant?.itens ?? []).filter((i) => b.itens[i.id]);
    const idsAntes = new Set((ant?.itens ?? []).map((i) => i.id));
    const datas = new Map<string, { inicio: ISODate; fim: ISODate }>();

    // 1) Itens que já existiam com entrada.
    for (const i of a.itens) {
      const ent = b.itens[i.id];
      if (!ent || !idsAntes.has(i.id)) continue;
      const junta = a.itens.length === 1 && tipoLocal.get(i.localId) === 'obra' && entradasAntes.length >= 2;
      datas.set(i.id, junta
        ? { inicio: minData(entradasAntes.map((x) => b.itens[x.id].inicio)), fim: maxData(entradasAntes.map((x) => b.itens[x.id].fim)) }
        : { inicio: ent.inicio, fim: ent.fim });
    }
    // 2) Itens novos: split = datas do original; andar novo = datas do vizinho (baixo, senão cima).
    const comEntrada = a.itens.filter((i) => datas.has(i.id));
    for (const i of a.itens) {
      if (datas.has(i.id)) continue;
      let ref: { inicio: ISODate; fim: ISODate } | undefined;
      if (entradasAntes.length === 1) {
        const e0 = b.itens[entradasAntes[0].id];
        ref = { inicio: e0.inicio, fim: e0.fim };
      } else {
        const pos = posDe.get(i.localId);
        const viz = pos === undefined ? undefined : vizinhoDoAndar(comEntrada, posDe, pos);
        if (viz) ref = datas.get(viz.id);
        else if (entradasAntes.length) {
          ref = { inicio: minData(entradasAntes.map((x) => b.itens[x.id].inicio)), fim: maxData(entradasAntes.map((x) => b.itens[x.id].fim)) };
        }
      }
      if (ref) datas.set(i.id, { ...ref });
    }
    // 3) Valores: total da atividade redividido igualmente entre os itens que têm entrada.
    const comDatas = a.itens.filter((i) => datas.has(i.id));
    const vs = dividirIgual(total.get(id)!, comDatas.length);
    comDatas.forEach((i, k) => {
      const d = datas.get(i.id)!;
      itens[i.id] = { inicio: d.inicio, fim: d.fim, valor: vs[k] } satisfies ItemBase;
    });
  }

  return { ...b, itens };
}
