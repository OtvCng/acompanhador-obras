/**
 * MOTOR DE CÁLCULO (contrato). Assinaturas fixas; corpos são implementados pelo terminal Fundação.
 * Funções puras: recebem a obra e uma data de referência ("hoje"), nunca leem relógio sozinhas.
 */
import type { Obra, ISODate, Indicadores, PontoCurvaS, FaixaSaude, EtapaObra, Local, Baseline } from './types';

/** Feriados nacionais fixos + móveis (Páscoa) do ano. */
export function feriadosNacionais(ano: number): ISODate[] { void ano; return []; }
export function ehDiaUtil(data: ISODate): boolean { void data; return true; }
/** Soma n dias úteis (n >= 0). addDiasUteis(inicio, duracao - 1) = fim inclusivo. */
export function addDiasUteis(data: ISODate, n: number): ISODate { void n; return data; }
/** Dias úteis entre a e b, inclusivo nas duas pontas. */
export function contarDiasUteis(a: ISODate, b: ISODate): number { void a; void b; return 0; }

export function baselineVigente(obra: Obra): Baseline | null { return obra.baselines.at(-1) ?? null; }

/** Q15: régua SPI do prya + estados cinza/azul. */
export function faixaPorSpi(spi: number | null, realizado: number, concluida: boolean): FaixaSaude {
  void spi; void realizado; void concluida; return 'nao_iniciada';
}

/** Indicadores da obra inteira em `hoje`. */
export function indicadoresObra(obra: Obra, hoje: ISODate): Indicadores { void obra; void hoje; return vazio(); }
/** Indicadores de uma etapa. */
export function indicadoresEtapa(obra: Obra, etapa: EtapaObra, hoje: ISODate): Indicadores { void obra; void etapa; void hoje; return vazio(); }
/** Indicadores de um local (pavimento/unidade) somando todas as atividades daquele local. */
export function indicadoresLocal(obra: Obra, local: Local, hoje: ISODate): Indicadores { void obra; void local; void hoje; return vazio(); }
/** Planejado (0..1) de um item contra a baseline, proporcional a dias úteis (Q14). */
export function planejadoItem(obra: Obra, itemId: string, hoje: ISODate): number { void obra; void itemId; void hoje; return 0; }

/** Curva S semanal da baseline vigente, de dataInicio até o fim previsto. */
export function curvaS(obra: Obra, hoje: ISODate): PontoCurvaS[] { void obra; void hoje; return []; }

/** Fim previsto pela baseline vigente (ou pelas datas atuais se não houver baseline). */
export function fimPrevisto(obra: Obra): ISODate { return obra.dataInicio; }

/** Atividade/etapa atual: a(s) etapa(s) com item em andamento em `hoje`. Usado no card "etapa atual". */
export function etapasEmAndamento(obra: Obra, hoje: ISODate): EtapaObra[] { void obra; void hoje; return []; }

/** Etapas cujo valor orçado está fora da faixa Caixa (Q19). */
export function etapasForaDaFaixa(obra: Obra): { codigo: number; percentual: number; faixaMin: number; faixaMax: number }[] { void obra; return []; }

function vazio(): Indicadores {
  return { realizado: 0, planejado: 0, spi: null, desvioPP: 0, alertaCaixa: false, faixa: 'nao_iniciada', valorAgregado: 0, valorPlanejado: 0 };
}
