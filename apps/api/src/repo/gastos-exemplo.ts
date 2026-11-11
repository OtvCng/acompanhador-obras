/**
 * Gastos FICTÍCIOS das obras de exemplo (todos com exemplo = true). Nada aqui é dado real:
 * fornecedores e documentos têm "Exemplo" no nome.
 *
 * Como gera: cada avanço apontado (valor orçado × % que subiu) vira gastos no mesmo mês, um pouco antes
 * do apontamento, repartidos por categoria conforme a etapa; ~15% de cada etapa entra como "Geral da etapa".
 * No fim tudo é reescalado para o gasto total bater com o alvo da obra:
 *   galpão ~12% acima do valor feito · geminadas dentro · sobrado abaixo · casa concluída fecha ~4% acima ·
 *   prédio 3-6 em atenção · torre dentro.  (plano 2026-11-10-15-37)
 */
import { addDias, indicadoresCustoObra, type CategoriaGasto, type Gasto, type ISODate, type Obra, type TipoObra } from '@obras/shared';

/** Gasto real ÷ valor do que foi feito (obra concluída: ÷ orçado). */
export const ALVO_EXEMPLO: Record<TipoObra, number> = {
  comercial: 1.12,
  geminadas: 1.0,
  sobrado: 0.93,
  casa_terrea: 1.04,
  predio_3_6: 1.05,
  predio_7_mais: 1.01,
};

/** Mistura de categorias por etapa (EAP Caixa). Padrão para as não listadas. */
const MIX: Record<number, [CategoriaGasto, number][]> = {
  1: [['terceiros', 0.5], ['equipamento', 0.3], ['outros', 0.2]],
  2: [['material', 0.5], ['mao_de_obra', 0.3], ['equipamento', 0.2]],
  3: [['material', 0.55], ['mao_de_obra', 0.35], ['equipamento', 0.1]],
  15: [['terceiros', 0.7], ['material', 0.3]],
};
const MIX_PADRAO: [CategoriaGasto, number][] = [['material', 0.55], ['mao_de_obra', 0.35], ['terceiros', 0.1]];

const FORNECEDORES: Record<CategoriaGasto, string[]> = {
  material: ['Depósito Exemplo Ltda', 'Materiais Fictícios ME', 'Casa da Obra Modelo'],
  mao_de_obra: ['Equipe própria (exemplo)', 'Empreiteiro Exemplo'],
  equipamento: ['Locadora Exemplo', 'Andaimes Modelo Ltda'],
  terceiros: ['Prestadora Exemplo S/A', 'Serviços Fictícios Ltda'],
  outros: ['Fornecedor Exemplo'],
};
const GERAL = ['Frete de materiais', 'Caçamba de entulho', 'Ferramentas e EPI', 'Água e energia do canteiro'];

/** PRNG determinístico (mulberry32) para os exemplos saírem sempre iguais. */
function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const cents = (n: number) => Math.round(n * 100);

export function gerarGastosExemplo(obra: Obra, hoje: ISODate, autorPadrao?: string): Gasto[] {
  const alvo = ALVO_EXEMPLO[obra.tipo] ?? 1;
  const r = rng(hash(obra.id));
  const itemInfo = new Map<string, { etapa: number; atividadeId: string; atividadeNome: string; valor: number }>();
  for (const e of obra.etapas) for (const a of e.atividades) for (const i of a.itens) {
    itemInfo.set(i.id, { etapa: e.codigo, atividadeId: a.id, atividadeNome: a.nome, valor: i.valorOrcado });
  }

  // 1) Valor feito por (atividade, mês), a partir do histórico de apontamentos.
  const blocos = new Map<string, { etapa: number; atividadeId: string; atividadeNome: string; data: ISODate; valor: number }>();
  for (const ap of obra.apontamentos) {
    const info = itemInfo.get(ap.itemId);
    const delta = ap.percentualNovo - ap.percentualAnterior;
    if (!info || delta <= 0 || ap.data > hoje) continue;
    const k = `${info.atividadeId}|${ap.data.slice(0, 7)}`;
    const b = blocos.get(k);
    if (b) { b.valor += info.valor * delta / 100; if (ap.data < b.data) b.data = ap.data; }
    else blocos.set(k, { ...info, data: ap.data, valor: info.valor * delta / 100 });
  }

  // 2) Cada bloco vira 1 a 3 gastos por categoria; parte de cada etapa vai para "Geral da etapa".
  const brutos: Omit<Gasto, 'id' | 'criadoEm'>[] = [];
  const autor = autorPadrao ?? obra.encarregadoId;
  let doc = 1;
  for (const b of [...blocos.values()].sort((x, y) => (x.data < y.data ? -1 : 1))) {
    const data = (() => { const d = addDias(b.data, -Math.floor(r() * 6)); return d < obra.dataInicio ? obra.dataInicio : d; })();
    const geral = b.valor * 0.15;
    const mix = MIX[b.etapa] ?? MIX_PADRAO;
    const usadas = mix.slice(0, 1 + Math.floor(r() * mix.length));
    const somaPesos = usadas.reduce((s, [, p]) => s + p, 0);
    for (const [cat, p] of usadas) {
      const forn = FORNECEDORES[cat][Math.floor(r() * FORNECEDORES[cat].length)];
      brutos.push({
        obraId: obra.id, data, etapaCodigo: b.etapa, atividadeId: b.atividadeId, categoria: cat,
        valor: (b.valor - geral) * (p / somaPesos) * (0.9 + r() * 0.2),
        descricao: `${cat === 'mao_de_obra' ? 'Mão de obra' : cat === 'material' ? 'Material' : cat === 'equipamento' ? 'Locação de equipamento' : cat === 'terceiros' ? 'Serviço terceirizado' : 'Despesa'}: ${b.atividadeNome}`.slice(0, 200),
        fornecedor: forn, documento: `NF-EXEMPLO-${String(doc++).padStart(4, '0')}`, autorId: autor,
      });
    }
    brutos.push({
      obraId: obra.id, data, etapaCodigo: b.etapa, categoria: 'outros', valor: geral,
      descricao: GERAL[Math.floor(r() * GERAL.length)], fornecedor: 'Fornecedor Exemplo', autorId: autor,
    });
  }
  if (brutos.length === 0) return [];

  // 3) Reescala para o alvo (em centavos, o resto de arredondamento vai no maior gasto).
  const base = indicadoresCustoObra({ ...obra, gastos: [] }, hoje);
  const referencia = obra.status === 'concluida' ? base.orcado : base.agregado;
  const totalAlvo = cents(referencia * alvo);
  const totalBruto = brutos.reduce((s, g) => s + g.valor, 0);
  const valores = brutos.map((g) => Math.max(1, Math.round(cents(g.valor) * totalAlvo / cents(totalBruto))));
  const dif = totalAlvo - valores.reduce((s, x) => s + x, 0);
  const iMaior = valores.indexOf(Math.max(...valores));
  valores[iMaior] += dif;

  return brutos.map((g, i) => ({
    ...g,
    valor: valores[i] / 100,
    id: `gasto-ex-${obra.id}-${String(i + 1).padStart(4, '0')}`,
    criadoEm: `${g.data}T12:00:00.000Z`,
    exemplo: true,
  }));
}
