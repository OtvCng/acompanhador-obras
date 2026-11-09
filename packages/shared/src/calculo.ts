/**
 * MOTOR DE CÁLCULO (contrato). Assinaturas fixas; corpos são implementados pelo terminal Fundação.
 * Funções puras: recebem a obra e uma data de referência ("hoje"), nunca leem relógio sozinhas.
 *
 * Decisões de implementação (Fundação):
 * - Todas as contas de data usam UTC para não sofrer com fuso/horário de verão.
 * - Pesos dos indicadores e da Curva S = valorOrcado ATUAL de cada item; as DATAS do previsto vêm da baseline vigente.
 * - Itens que não existem na baseline vigente têm planejado 0.
 */
import type {
  Obra, ISODate, Indicadores, PontoCurvaS, FaixaSaude, EtapaObra, Local, Baseline, ItemAtividade,
} from './types';
import { ETAPAS_CAIXA } from './modelos';

// ---------------------------------------------------------------------------
// Datas (ISO "YYYY-MM-DD", sempre em UTC)
// ---------------------------------------------------------------------------
const DIA_MS = 86_400_000;

function paraMs(d: ISODate): number {
  const [a, m, dia] = d.split('-').map(Number);
  return Date.UTC(a, m - 1, dia);
}
function deMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Soma n dias corridos (n pode ser negativo). */
export function addDias(data: ISODate, n: number): ISODate {
  return deMs(paraMs(data) + n * DIA_MS);
}
/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: ISODate): number {
  return new Date(paraMs(data)).getUTCDay();
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): ISODate {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
const cacheFeriados = new Map<number, Set<ISODate>>();

/** Feriados nacionais fixos + móveis (Páscoa) do ano. */
export function feriadosNacionais(ano: number): ISODate[] {
  const p = pascoa(ano);
  const fixos = FIXOS.map((md) => `${ano}-${md}`);
  const moveis = [
    addDias(p, -48), // Carnaval (segunda)
    addDias(p, -47), // Carnaval (terça)
    addDias(p, -2), // Sexta-feira Santa
    addDias(p, 60), // Corpus Christi
  ];
  return [...fixos, ...moveis].sort();
}
function feriadosSet(ano: number): Set<ISODate> {
  let s = cacheFeriados.get(ano);
  if (!s) {
    s = new Set(feriadosNacionais(ano));
    cacheFeriados.set(ano, s);
  }
  return s;
}

export function ehDiaUtil(data: ISODate): boolean {
  const dow = diaDaSemana(data);
  if (dow === 0 || dow === 6) return false;
  return !feriadosSet(Number(data.slice(0, 4))).has(data);
}

/** Primeiro dia útil >= data. */
export function proximoDiaUtil(data: ISODate): ISODate {
  let d = data;
  while (!ehDiaUtil(d)) d = addDias(d, 1);
  return d;
}

/** Soma n dias úteis (n >= 0). addDiasUteis(inicio, duracao - 1) = fim inclusivo. Se `data` não for útil, parte do próximo dia útil. */
export function addDiasUteis(data: ISODate, n: number): ISODate {
  let d = proximoDiaUtil(data);
  let resta = Math.max(0, Math.round(n));
  while (resta > 0) {
    d = addDias(d, 1);
    if (ehDiaUtil(d)) resta--;
  }
  return d;
}

/** Dias úteis entre a e b, inclusivo nas duas pontas. 0 se b < a. */
export function contarDiasUteis(a: ISODate, b: ISODate): number {
  if (b < a) return 0;
  const ia = paraMs(a);
  const total = Math.round((paraMs(b) - ia) / DIA_MS) + 1;
  // Dias seg-sex por aritmética: semanas cheias + resto.
  let n = Math.floor(total / 7) * 5;
  const dow0 = diaDaSemana(a);
  for (let k = 0; k < total % 7; k++) {
    const dow = (dow0 + Math.floor(total / 7) * 7 + k) % 7;
    if (dow !== 0 && dow !== 6) n++;
  }
  // Menos os feriados que caem em dia de semana dentro do intervalo.
  for (let ano = Number(a.slice(0, 4)); ano <= Number(b.slice(0, 4)); ano++) {
    for (const f of feriadosSet(ano)) {
      if (f >= a && f <= b) {
        const dow = diaDaSemana(f);
        if (dow !== 0 && dow !== 6) n--;
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------
function todosItens(obra: Obra): ItemAtividade[] {
  return obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens));
}

export function baselineVigente(obra: Obra): Baseline | null { return obra.baselines.at(-1) ?? null; }

function fracaoLinear(inicio: ISODate, fim: ISODate, hoje: ISODate): number {
  if (hoje < inicio) return 0;
  if (hoje >= fim) return 1;
  const total = contarDiasUteis(inicio, fim);
  if (total <= 0) return 1;
  return Math.min(1, contarDiasUteis(inicio, hoje) / total);
}

const arred2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Faixa de saúde
// ---------------------------------------------------------------------------
/** Q15: régua SPI do prya + estados cinza/azul. */
export function faixaPorSpi(spi: number | null, realizado: number, concluida: boolean): FaixaSaude {
  if (concluida) return 'concluida';
  if (spi === null) return realizado > 0 ? 'adiantada' : 'nao_iniciada';
  const s = arred2(spi);
  if (s > 1) return 'adiantada';
  if (s >= 0.95) return 'no_prazo';
  if (s >= 0.85) return 'atencao';
  return 'atrasada';
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------
/** Planejado (0..1) de um item contra a baseline, proporcional a dias úteis (Q14). */
export function planejadoItem(obra: Obra, itemId: string, hoje: ISODate): number {
  const b = baselineVigente(obra);
  const bi = b?.itens[itemId];
  if (!bi) return 0;
  return fracaoLinear(bi.inicio, bi.fim, hoje);
}

function calcular(obra: Obra, itens: ItemAtividade[], hoje: ISODate, concluida: boolean): Indicadores {
  const total = itens.reduce((s, i) => s + i.valorOrcado, 0);
  const temBaseline = obra.baselines.length > 0;
  let valorAgregado = 0;
  let valorPlanejado = 0;
  for (const i of itens) {
    valorAgregado += i.valorOrcado * (i.percentual / 100);
    valorPlanejado += i.valorOrcado * planejadoItem(obra, i.id, hoje);
  }
  const realizado = total > 0 ? valorAgregado / total : 0;
  const planejado = total > 0 ? valorPlanejado / total : 0;
  const spi = planejado > 0 ? realizado / planejado : null;
  const desvioPP = (realizado - planejado) * 100;
  const faixa: FaixaSaude = concluida
    ? 'concluida'
    : !temBaseline
      ? 'nao_iniciada'
      : faixaPorSpi(spi, realizado, false);
  return {
    realizado,
    planejado,
    spi,
    desvioPP,
    alertaCaixa: Math.abs(desvioPP) > 10,
    faixa,
    valorAgregado: arred2(valorAgregado),
    valorPlanejado: arred2(valorPlanejado),
  };
}

const tudoConcluido = (itens: ItemAtividade[]) => itens.length > 0 && itens.every((i) => i.percentual >= 100);

/** Indicadores da obra inteira em `hoje`. */
export function indicadoresObra(obra: Obra, hoje: ISODate): Indicadores {
  return calcular(obra, todosItens(obra), hoje, obra.status === 'concluida');
}
/** Indicadores de uma etapa. */
export function indicadoresEtapa(obra: Obra, etapa: EtapaObra, hoje: ISODate): Indicadores {
  const itens = etapa.atividades.flatMap((a) => a.itens);
  return calcular(obra, itens, hoje, obra.status === 'concluida' || tudoConcluido(itens));
}
/** Indicadores de um local (pavimento/unidade) somando todas as atividades daquele local. */
export function indicadoresLocal(obra: Obra, local: Local, hoje: ISODate): Indicadores {
  const itens = todosItens(obra).filter((i) => i.localId === local.id);
  return calcular(obra, itens, hoje, obra.status === 'concluida' || tudoConcluido(itens));
}

// ---------------------------------------------------------------------------
// Curva S
// ---------------------------------------------------------------------------
/** Percentual vigente de cada item numa data, reconstruído pelo histórico de apontamentos. */
function percentuaisEm(obra: Obra, data: ISODate, ordenados: Obra['apontamentos']): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of ordenados) {
    if (a.data > data) break;
    m.set(a.itemId, a.percentualNovo);
  }
  return m;
}

/** Curva S semanal (sextas) da baseline vigente, de dataInicio até o fim previsto (ou até o último apontamento, se passar dele). */
export function curvaS(obra: Obra, hoje: ISODate): PontoCurvaS[] {
  const itens = todosItens(obra);
  const total = itens.reduce((s, i) => s + i.valorOrcado, 0);
  if (total <= 0) return [];
  const b = baselineVigente(obra);
  const ordenados = obra.apontamentos
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => (x.a.data === y.a.data ? x.idx - y.idx : x.a.data < y.a.data ? -1 : 1))
    .map((x) => x.a);

  let fim = fimPrevisto(obra);
  const ultimoAp = ordenados.at(-1)?.data;
  if (ultimoAp && ultimoAp > fim) fim = ultimoAp;

  // primeira sexta >= dataInicio
  let d = obra.dataInicio;
  while (diaDaSemana(d) !== 5) d = addDias(d, 1);

  const pontos: PontoCurvaS[] = [];
  for (let guarda = 0; guarda < 1000; guarda++) {
    let prevValor = 0;
    if (b) {
      for (const i of itens) {
        const bi = b.itens[i.id];
        if (bi) prevValor += i.valorOrcado * fracaoLinear(bi.inicio, bi.fim, d);
      }
    }
    let realValor: number | null = null;
    if (d <= hoje) {
      const pcts = percentuaisEm(obra, d, ordenados);
      realValor = 0;
      for (const i of itens) realValor += i.valorOrcado * ((pcts.get(i.id) ?? 0) / 100);
    }
    pontos.push({
      data: d,
      previsto: prevValor / total,
      realizado: realValor === null ? null : realValor / total,
      previstoValor: arred2(prevValor),
      realizadoValor: realValor === null ? null : arred2(realValor),
    });
    if (d >= fim) break;
    d = addDias(d, 7);
  }
  return pontos;
}

/** Fim previsto pela baseline vigente (ou pelas datas atuais se não houver baseline). */
export function fimPrevisto(obra: Obra): ISODate {
  const b = baselineVigente(obra);
  let fim = obra.dataInicio;
  if (b) {
    for (const bi of Object.values(b.itens)) if (bi.fim > fim) fim = bi.fim;
    return fim;
  }
  for (const i of todosItens(obra)) if (i.fimPlanejado > fim) fim = i.fimPlanejado;
  return fim;
}

/** Atividade/etapa atual: a(s) etapa(s) com item em andamento em `hoje`. Usado no card "etapa atual".
 * Em andamento = 0 < % < 100. Se nenhum item estiver assim, usa os itens cuja janela da baseline (ou planejada) contém `hoje`. */
export function etapasEmAndamento(obra: Obra, hoje: ISODate): EtapaObra[] {
  const comApontamento = obra.etapas.filter((e) =>
    e.atividades.some((a) => a.itens.some((i) => i.percentual > 0 && i.percentual < 100)),
  );
  if (comApontamento.length > 0) return comApontamento;
  const b = baselineVigente(obra);
  return obra.etapas.filter((e) =>
    e.atividades.some((a) =>
      a.itens.some((i) => {
        const ini = b?.itens[i.id]?.inicio ?? i.inicioPlanejado;
        const fim = b?.itens[i.id]?.fim ?? i.fimPlanejado;
        return i.percentual < 100 && ini <= hoje && hoje <= fim;
      }),
    ),
  );
}

/** Etapas cujo valor orçado está fora da faixa Caixa (Q19). Percentual sobre a soma dos valores das etapas. */
export function etapasForaDaFaixa(obra: Obra): { codigo: number; percentual: number; faixaMin: number; faixaMax: number }[] {
  const total = obra.etapas.reduce((s, e) => s + e.valorOrcado, 0);
  if (total <= 0) return [];
  const out: { codigo: number; percentual: number; faixaMin: number; faixaMax: number }[] = [];
  for (const e of obra.etapas) {
    const ref = ETAPAS_CAIXA.find((r) => r.codigo === e.codigo);
    if (!ref || ref.faixaMin === null || ref.faixaMax === null) continue;
    const percentual = arred2((e.valorOrcado / total) * 100);
    if (percentual < ref.faixaMin || percentual > ref.faixaMax) {
      out.push({ codigo: e.codigo, percentual, faixaMin: ref.faixaMin, faixaMax: ref.faixaMax });
    }
  }
  return out;
}
