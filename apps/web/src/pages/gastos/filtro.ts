import type { CategoriaGasto, Gasto, Obra } from '@obras/shared';

export interface FiltroGastos {
  de: string; // ISO ou ''
  ate: string; // ISO ou ''
  etapa: number | null;
  /** '' = todas · 'geral' = só "Geral da etapa" (sem atividade) · id da atividade */
  atividade: string;
  categoria: CategoriaGasto | '';
  texto: string;
}

export const FILTRO_VAZIO: FiltroGastos = { de: '', ate: '', etapa: null, atividade: '', categoria: '', texto: '' };

export const ATIVIDADE_GERAL = 'geral';

export function filtroAtivo(f: FiltroGastos): boolean {
  return !!(f.de || f.ate || f.etapa !== null || f.atividade || f.categoria || f.texto.trim());
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

/** Nomes de etapa e atividade por id, para buscar e exibir. */
export function indiceObra(obra: Obra) {
  const etapas = new Map(obra.etapas.map((e) => [e.codigo, e.nome]));
  const atividades = new Map<string, { codigo: string; nome: string; etapaCodigo: number }>();
  for (const e of obra.etapas) for (const a of e.atividades) atividades.set(a.id, { codigo: a.codigo, nome: a.nome, etapaCodigo: e.codigo });
  return { etapas, atividades };
}

/** Filtra e ordena (mais recente primeiro; empate pela criação). */
export function filtrarGastos(obra: Obra, gastos: Gasto[], f: FiltroGastos): Gasto[] {
  const { etapas, atividades } = indiceObra(obra);
  const q = semAcento(f.texto.trim());
  return gastos
    .filter((g) => {
      if (f.de && g.data < f.de) return false;
      if (f.ate && g.data > f.ate) return false;
      if (f.etapa !== null && g.etapaCodigo !== f.etapa) return false;
      if (f.atividade === ATIVIDADE_GERAL && g.atividadeId) return false;
      if (f.atividade && f.atividade !== ATIVIDADE_GERAL && g.atividadeId !== f.atividade) return false;
      if (f.categoria && g.categoria !== f.categoria) return false;
      if (q) {
        const at = g.atividadeId ? atividades.get(g.atividadeId) : undefined;
        const txt = semAcento(`${g.descricao} ${g.fornecedor ?? ''} ${g.documento ?? ''} ${etapas.get(g.etapaCodigo) ?? ''} ${at ? `${at.codigo} ${at.nome}` : ''}`);
        if (!txt.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.data === b.data ? b.criadoEm.localeCompare(a.criadoEm) : b.data.localeCompare(a.data)));
}

/** Soma em centavos para não acumular erro de ponto flutuante. */
export const somarGastos = (gs: Gasto[]) => gs.reduce((s, g) => s + Math.round(g.valor * 100), 0) / 100;

export interface LoteImportacao {
  id: string;
  quantidade: number;
  total: number;
  /** criadoEm mais antigo do lote (ISO datetime). */
  em: string;
  autorId: string;
  de: string;
  ate: string;
}

/** Lotes de importação presentes nos gastos da obra, do mais recente para o mais antigo. */
export function lotesImportados(gastos: Gasto[]): LoteImportacao[] {
  const m = new Map<string, Gasto[]>();
  for (const g of gastos) if (g.importacaoId) m.set(g.importacaoId, [...(m.get(g.importacaoId) ?? []), g]);
  return [...m].map(([id, gs]) => {
    const datas = gs.map((g) => g.data).sort();
    return {
      id,
      quantidade: gs.length,
      total: somarGastos(gs),
      em: gs.map((g) => g.criadoEm).sort()[0],
      autorId: gs[0].autorId,
      de: datas[0],
      ate: datas[datas.length - 1],
    };
  }).sort((a, b) => b.em.localeCompare(a.em));
}
