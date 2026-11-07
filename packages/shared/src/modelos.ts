/**
 * EAP Caixa (20 itens) + 6 modelos por tipo + gerador de obra (contrato).
 * Conteúdo preenchido pelo terminal Fundação a partir da pesquisa.
 */
import type { EtapaReferencia, ModeloObra, TipoObra, ParametrosNovaObra, Obra, Baseline, ISODate } from './types';

export const ETAPAS_CAIXA: EtapaReferencia[] = [];
export const MODELOS: Record<TipoObra, ModeloObra> = {} as Record<TipoObra, ModeloObra>;
export const NOMES_TIPO: Record<TipoObra, string> = {
  casa_terrea: 'Casa térrea',
  geminadas: 'Casas geminadas',
  sobrado: 'Sobrado',
  predio_3_6: 'Prédio 3 a 6 pavimentos',
  predio_7_mais: 'Prédio 7+ pavimentos',
  comercial: 'Comercial térreo / galpão',
};

/** Gera a obra em status 'planejamento', sem baseline, com valores estimados (Q19) e datas pela rede de precedência. */
export function gerarObra(params: ParametrosNovaObra, id: string, modelo: ModeloObra = MODELOS[params.tipo]): Obra {
  void params; void id; void modelo; throw new Error('gerarObra: não implementado');
}

/** Congela baseline (v1 sem justificativa; v2+ exige justificativa). Retorna nova obra (imutável). */
export function congelarBaseline(obra: Obra, autorId: string, hoje: ISODate, justificativa?: string): Obra {
  void obra; void autorId; void hoje; void justificativa; throw new Error('congelarBaseline: não implementado');
}

export type { Baseline };
