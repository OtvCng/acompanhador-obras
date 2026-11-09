import type { ModeloAtividade, ModeloObra } from '@obras/shared';

/** Tolerância da soma dos pesos de uma etapa (fração). 0,0005 = 0,05 ponto percentual. */
export const TOLERANCIA_PESO = 0.0005;

export function somaPesosPorEtapa(m: ModeloObra): Map<number, number> {
  const s = new Map<number, number>();
  for (const a of m.atividades) s.set(a.etapaCodigo, (s.get(a.etapaCodigo) ?? 0) + a.pesoNaEtapa);
  return s;
}

/** Etapas cujas atividades não somam 100%. */
export function etapasComPesoInvalido(m: ModeloObra): number[] {
  return [...somaPesosPorEtapa(m)].filter(([, v]) => Math.abs(v - 1) > TOLERANCIA_PESO).map(([k]) => k);
}

/** Reescala os pesos de uma etapa para somarem exatamente 1 (resíduo na maior atividade). */
export function normalizarEtapa(m: ModeloObra, etapa: number): ModeloObra {
  const doEtapa = m.atividades.filter((a) => a.etapaCodigo === etapa);
  const soma = doEtapa.reduce((s, a) => s + a.pesoNaEtapa, 0);
  const novo = new Map<string, number>();
  doEtapa.forEach((a) => novo.set(a.codigo, soma > 0 ? Math.round((a.pesoNaEtapa / soma) * 10000) / 10000 : Math.round(10000 / doEtapa.length) / 10000));
  const total = [...novo.values()].reduce((s, v) => s + v, 0);
  const maior = doEtapa.reduce<ModeloAtividade | null>((acc, a) => (!acc || novo.get(a.codigo)! > novo.get(acc.codigo)! ? a : acc), null);
  if (maior) novo.set(maior.codigo, Math.round((novo.get(maior.codigo)! + (1 - total)) * 10000) / 10000);
  return { ...m, atividades: m.atividades.map((a) => (novo.has(a.codigo) ? { ...a, pesoNaEtapa: novo.get(a.codigo)! } : a)) };
}

export function modeloFoiEditado(atual: ModeloObra, padrao: ModeloObra): boolean {
  return JSON.stringify(atual) !== JSON.stringify(padrao);
}
