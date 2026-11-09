import type { ISODate, StatusObra, TipoPavimento } from '@obras/shared';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatarBRL = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
export const formatarNumero = (v: number) => NUM.format(v);
/** Percentual 0..100 com uma casa: "12,5%". */
export const formatarPct = (v: number) => `${NUM2.format(Number.isFinite(v) ? v : 0)}%`;
/** Percentual 0..100 sem casas: "12%". */
export const formatarPctInteiro = (v: number) => `${Math.round(Number.isFinite(v) ? v : 0)}%`;

/** "2026-11-07" → "07/11/2026" (sem passar por Date, para não sofrer com fuso). */
export function formatarData(d: ISODate | undefined): string {
  if (!d) return '';
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

/** "2026-11-07" → "07/11". */
export function formatarDataCurta(d: ISODate | undefined): string {
  if (!d) return '';
  const [, m, dia] = d.split('-');
  return `${dia}/${m}`;
}

/** Soma dias corridos a uma data ISO (UTC, sem fuso). */
export function somarDiasCorridos(d: ISODate, n: number): ISODate {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(d: ISODate): number {
  return new Date(`${d}T00:00:00Z`).getUTCDay();
}

/** Converte texto digitado em pt-BR ("1.234,56" ou "1234.56") em número. NaN se inválido. */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(/\s|R\$/g, '');
  if (!t) return NaN;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normal);
}

export const NOMES_PAVIMENTO: Record<TipoPavimento, string> = {
  subsolo_garagem: 'Subsolo / garagem',
  terreo: 'Térreo',
  terreo_comercial: 'Térreo comercial',
  tipo: 'Pavimento tipo',
  cobertura: 'Cobertura',
  casa_maquinas: 'Casa de máquinas',
};

export const NOMES_STATUS: Record<StatusObra, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
};
