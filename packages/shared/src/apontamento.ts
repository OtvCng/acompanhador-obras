/**
 * Regra de apontamento compartilhada entre o front (atualização otimista) e a API (fonte da verdade).
 * Extraída do store mock (Fundação) sem mudar o comportamento.
 */
import type { Apontamento, ISODate, Obra } from './types';

export interface NovoApontamento {
  itemId: string;
  percentualNovo: number;
  observacao?: string;
  fotos?: string[];
}

/** Aplica um apontamento na obra. Devolve null se o item não existe na obra. */
export function aplicarApontamento(
  obra: Obra,
  a: NovoApontamento,
  autorId: string,
  hoje: ISODate,
  apontamentoId: string,
): { obra: Obra; apontamento: Apontamento } | null {
  const existe = obra.etapas.some((e) => e.atividades.some((at) => at.itens.some((i) => i.id === a.itemId)));
  if (!existe) return null;
  const novo = Math.max(0, Math.min(100, Math.round(a.percentualNovo)));
  let anterior = 0;
  const etapas = obra.etapas.map((e) => ({
    ...e,
    atividades: e.atividades.map((at) => ({
      ...at,
      itens: at.itens.map((i) => {
        if (i.id !== a.itemId) return i;
        anterior = i.percentual;
        const item = { ...i, percentual: novo };
        if (novo > 0 && !item.inicioReal) item.inicioReal = hoje;
        if (novo === 0) delete item.inicioReal;
        if (novo >= 100) item.fimReal = item.fimReal && i.percentual >= 100 ? item.fimReal : hoje;
        else delete item.fimReal;
        return item;
      }),
    })),
  }));
  const apontamento: Apontamento = {
    id: apontamentoId,
    itemId: a.itemId,
    data: hoje,
    percentualAnterior: anterior,
    percentualNovo: novo,
    ...(a.observacao?.trim() ? { observacao: a.observacao.trim() } : {}),
    fotos: a.fotos ?? [],
    autorId,
  };
  const todos = etapas.flatMap((e) => e.atividades.flatMap((at) => at.itens));
  const tudoPronto = todos.length > 0 && todos.every((i) => i.percentual >= 100);
  let status = obra.status;
  if (tudoPronto) status = 'concluida';
  else if (obra.status === 'concluida' || (obra.status === 'planejamento' && novo > 0)) status = 'em_andamento';
  return { obra: { ...obra, etapas, status, apontamentos: [...obra.apontamentos, apontamento] }, apontamento };
}

/**
 * Reescala os valores em R$ de uma obra para pesos (orçamento total = 100).
 * Usado pela API para o perfil encarregado: os indicadores não mudam (o motor só usa proporções)
 * e nenhum valor em reais sai do servidor.
 */
export function ocultarValores(obra: Obra): Obra {
  const total = obra.orcamentoTotal || obra.etapas.reduce((s, e) => s + e.valorOrcado, 0) || 1;
  const f = 100 / total;
  const r = (v: number) => Math.round(v * f * 1e6) / 1e6;
  return {
    ...obra,
    orcamentoTotal: 100,
    etapas: obra.etapas.map((e) => ({
      ...e,
      valorOrcado: r(e.valorOrcado),
      atividades: e.atividades.map((at) => ({ ...at, itens: at.itens.map((i) => ({ ...i, valorOrcado: r(i.valorOrcado) })) })),
    })),
    baselines: obra.baselines.map((b) => ({
      ...b,
      itens: Object.fromEntries(Object.entries(b.itens).map(([k, v]) => [k, { ...v, valor: r(v.valor) }])),
    })),
    // Gastos na mesma escala: CPI e desvio % continuam certos, sem sair R$.
    gastos: (obra.gastos ?? []).map((g) => ({ ...g, valor: r(g.valor) })),
  };
}
