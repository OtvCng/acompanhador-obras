/**
 * Justificativa de alteração de prazo (plano 2026-11-11-15-05).
 *
 * Uma etapa ou atividade precisa de justificativa quando, NESTE save, o início ou o fim dela mudou
 * e ficou a mais de `limite` dias úteis da baseline inicial (v1). O span de etapa/atividade vai do
 * primeiro início ao último fim dos seus itens. Itens sem baseline (novos) ficam fora da régua.
 */
import { contarDiasUteis, ehDiaUtil } from './calculo';
import type { DesvioCronograma, ISODate, ItemAtividade, Obra } from './types';

export const LIMITE_JUSTIFICATIVA_DU = 5;

/** Diferença assinada em dias úteis de `a` até `b` (0 se iguais; + se b depois de a). */
export function difDiasUteis(a: ISODate, b: ISODate): number {
  if (a === b) return 0;
  if (b > a) return contarDiasUteis(a, b) - (ehDiaUtil(a) ? 1 : 0);
  return -(contarDiasUteis(b, a) - (ehDiaUtil(b) ? 1 : 0));
}

type Span = { inicio: ISODate; fim: ISODate };

function span(itens: ItemAtividade[], datas: (i: ItemAtividade) => Span | null): Span | null {
  let inicio: ISODate | null = null;
  let fim: ISODate | null = null;
  for (const i of itens) {
    const d = datas(i);
    if (!d) continue;
    if (inicio == null || d.inicio < inicio) inicio = d.inicio;
    if (fim == null || d.fim > fim) fim = d.fim;
  }
  return inicio != null && fim != null ? { inicio, fim } : null;
}

/**
 * Compara a obra salva (`antes`) com a que vai ser salva (`depois`). Sem baseline em `antes`, nada a justificar
 * (o primeiro save congela a inicial).
 */
export function desviosParaJustificar(antes: Obra, depois: Obra, limite = LIMITE_JUSTIFICATIVA_DU): DesvioCronograma[] {
  const b = antes.baselines[0];
  if (!b) return [];
  const itensAntes = new Map(antes.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)).map((i) => [i.id, i]));
  const naBase = (i: ItemAtividade) => (b.itens[i.id] ? { inicio: b.itens[i.id]!.inicio, fim: b.itens[i.id]!.fim } : null);
  const comoEra = (i: ItemAtividade) => {
    const x = itensAntes.get(i.id);
    return x ? { inicio: x.inicioPlanejado, fim: x.fimPlanejado } : null;
  };
  const agora = (i: ItemAtividade) => ({ inicio: i.inicioPlanejado, fim: i.fimPlanejado });

  const out: DesvioCronograma[] = [];
  const avaliar = (tipo: DesvioCronograma['tipo'], codigo: string, nome: string, itens: ItemAtividade[]) => {
    // Só os itens que existem na baseline entram na régua.
    const comBase = itens.filter((i) => b.itens[i.id]);
    if (!comBase.length) return;
    const sb = span(comBase, naBase)!;
    const sd = span(comBase, agora)!;
    const sa = span(comBase, comoEra) ?? sd;
    if (sa.inicio === sd.inicio && sa.fim === sd.fim) return; // não mudou neste save
    const desvioInicio = difDiasUteis(sb.inicio, sd.inicio);
    const desvioFim = difDiasUteis(sb.fim, sd.fim);
    if (Math.abs(desvioInicio) > limite || Math.abs(desvioFim) > limite) {
      out.push({ tipo, codigo, nome, base: sb, antes: sa, depois: sd, desvioInicio, desvioFim });
    }
  };

  for (const e of depois.etapas) {
    avaliar('etapa', String(e.codigo), e.nome, e.atividades.flatMap((a) => a.itens));
    for (const a of e.atividades) avaliar('atividade', a.codigo, a.nome, a.itens);
  }
  return out;
}
