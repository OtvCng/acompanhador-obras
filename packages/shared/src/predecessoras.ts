/**
 * Predecessoras entre ETAPAS (planejamento 2026-11-11-14-10).
 *
 * Regra: término→início puro. A etapa só começa no dia útil seguinte ao maior fim entre as predecessoras.
 * A reprogramação só EMPURRA para frente, desloca todos os itens da etapa pelo mesmo nº de dias úteis
 * (mantém duração e espaçamento) e não mexe em etapa já iniciada (algum item com avanço > 0).
 */
import { addDiasUteis, contarDiasUteis } from './calculo';
import type { EtapaObra, ISODate, Obra } from './types';

export type DatasItem = { inicio: ISODate; fim: ISODate };

export function predecessorasDe(e: EtapaObra): number[] {
  return e.predecessoras ?? [];
}

/** Problemas de cadastro: autorreferência, etapa inexistente, repetida ou ciclo. Vazio = ok. */
export function validarPredecessoras(etapas: Pick<EtapaObra, 'codigo' | 'predecessoras'>[]): string[] {
  const erros: string[] = [];
  const cods = new Set(etapas.map((e) => e.codigo));
  for (const e of etapas) {
    const ps = e.predecessoras ?? [];
    if (new Set(ps).size !== ps.length) erros.push(`Etapa ${e.codigo}: predecessora repetida.`);
    for (const p of ps) {
      if (p === e.codigo) erros.push(`Etapa ${e.codigo} não pode ser predecessora dela mesma.`);
      else if (!cods.has(p)) erros.push(`Etapa ${e.codigo}: predecessora ${p} não existe nesta obra.`);
    }
  }
  if (!erros.length && ordemTopologica(etapas) == null) erros.push('As predecessoras formam um ciclo (uma etapa acaba dependendo dela mesma).');
  return erros;
}

/** Ordem em que toda predecessora vem antes da sucessora. null = ciclo. Desempate pelo código. */
export function ordemTopologica(etapas: Pick<EtapaObra, 'codigo' | 'predecessoras'>[]): number[] | null {
  const cods = new Set(etapas.map((e) => e.codigo));
  const pend = new Map(etapas.map((e) => [e.codigo, new Set((e.predecessoras ?? []).filter((p) => cods.has(p) && p !== e.codigo))]));
  const ordem: number[] = [];
  while (pend.size) {
    const prontas = [...pend].filter(([, ps]) => ps.size === 0).map(([c]) => c).sort((a, b) => a - b);
    if (!prontas.length) return null;
    for (const c of prontas) {
      ordem.push(c);
      pend.delete(c);
      for (const ps of pend.values()) ps.delete(c);
    }
  }
  return ordem;
}

/** Etapas que NÃO podem virar predecessoras de `codigo` (ela mesma e quem depende dela, direta ou indiretamente). */
export function sucessorasTransitivas(etapas: Pick<EtapaObra, 'codigo' | 'predecessoras'>[], codigo: number): Set<number> {
  const s = new Set<number>([codigo]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const e of etapas) if (!s.has(e.codigo) && (e.predecessoras ?? []).some((p) => s.has(p))) {
      s.add(e.codigo);
      mudou = true;
    }
  }
  return s;
}

function spanEtapa(e: EtapaObra, datas: (itemId: string) => DatasItem): DatasItem | null {
  let inicio: ISODate | null = null;
  let fim: ISODate | null = null;
  for (const a of e.atividades) for (const it of a.itens) {
    const d = datas(it.id);
    if (inicio == null || d.inicio < inicio) inicio = d.inicio;
    if (fim == null || d.fim > fim) fim = d.fim;
  }
  return inicio != null && fim != null ? { inicio, fim } : null;
}

const iniciada = (e: EtapaObra) => e.atividades.some((a) => a.itens.some((i) => i.percentual > 0));

/** Desloca um item k dias úteis mantendo a duração em dias úteis. */
function deslocar(d: DatasItem, k: number): DatasItem {
  const du = Math.max(1, contarDiasUteis(d.inicio, d.fim));
  const inicio = addDiasUteis(d.inicio, k);
  return { inicio, fim: addDiasUteis(inicio, du - 1) };
}

export interface ResultadoReprogramacao {
  /** Novas datas dos itens que mudaram (itemId → datas). */
  datas: Record<string, DatasItem>;
  /** Etapas empurradas e quantos dias úteis. */
  empurradas: { codigo: number; dias: number }[];
  /** Etapas já iniciadas que começam antes de a predecessora terminar (não são movidas). */
  violacoes: { codigo: number; inicioMinimo: ISODate }[];
}

/**
 * Aplica a regra término→início nas datas atuais (`base` sobrescreve as do item, ex.: rascunho da tela).
 * Etapas fora de ordem por ciclo são ignoradas (a validação barra o ciclo antes de salvar).
 */
export function reprogramarPorPredecessoras(obra: Obra, base: Record<string, DatasItem> = {}): ResultadoReprogramacao {
  const res: ResultadoReprogramacao = { datas: {}, empurradas: [], violacoes: [] };
  const ordem = ordemTopologica(obra.etapas);
  if (!ordem) return res;
  const porCodigo = new Map(obra.etapas.map((e) => [e.codigo, e]));
  const itens = new Map(obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)).map((i) => [i.id, i]));
  const datas = (id: string): DatasItem => {
    const i = itens.get(id)!;
    return res.datas[id] ?? base[id] ?? { inicio: i.inicioPlanejado, fim: i.fimPlanejado };
  };

  for (const cod of ordem) {
    const e = porCodigo.get(cod)!;
    const preds = predecessorasDe(e).map((p) => porCodigo.get(p)).filter((p): p is EtapaObra => !!p);
    if (!preds.length) continue;
    const span = spanEtapa(e, datas);
    if (!span) continue;
    let fimPred: ISODate | null = null;
    for (const p of preds) {
      const sp = spanEtapa(p, datas);
      if (sp && (!fimPred || sp.fim > fimPred)) fimPred = sp.fim;
    }
    if (!fimPred) continue;
    const inicioMinimo = addDiasUteis(fimPred, 1);
    if (span.inicio >= inicioMinimo) continue;
    if (iniciada(e)) {
      res.violacoes.push({ codigo: cod, inicioMinimo });
      continue;
    }
    // k = dias úteis para o primeiro início chegar ao mínimo (ajuste fino se o início cair em dia não útil).
    let k = Math.max(1, contarDiasUteis(span.inicio, inicioMinimo) - 1);
    while (addDiasUteis(span.inicio, k) < inicioMinimo) k++;
    for (const a of e.atividades) for (const it of a.itens) res.datas[it.id] = deslocar(datas(it.id), k);
    res.empurradas.push({ codigo: cod, dias: k });
  }
  return res;
}
