/** Formatação pt-BR usada em todas as telas. */
import type { ISODate } from '@obras/shared';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const num = (casas: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** R$ 1.234,56 */
export function formatBRL(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'R$ 0,00';
  return brl.format(v);
}
/** R$ 1,2 mi (eixos e KPIs compactos) */
export function formatBRLCompacto(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'R$ 0';
  return brlCompacto.format(v);
}
/** Número com casas fixas e vírgula. */
export function formatNumero(v: number, casas = 0): string {
  return num(casas).format(v);
}
/** Fração 0..1 para "42,5%". */
export function formatPctFracao(f: number | null | undefined, casas = 1): string {
  if (f == null || Number.isNaN(f)) return '0%';
  return `${num(casas).format(f * 100)}%`;
}
/** Valor já em 0..100 para "42,5%". */
export function formatPct(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return '0%';
  return `${num(casas).format(v)}%`;
}
/** Pontos percentuais com sinal: "+3,2 pp" / "-12,0 pp". */
export function formatPP(v: number | null | undefined, casas = 1): string {
  if (v == null || Number.isNaN(v)) return '0 pp';
  const s = v > 0.0001 ? '+' : v < -0.0001 ? '-' : '';
  return `${s}${num(casas).format(Math.abs(v))} pp`;
}
/** SPI com vírgula e 2 casas; "sem dado" quando null. */
export function formatSPI(spi: number | null | undefined): string {
  if (spi == null || Number.isNaN(spi)) return 'sem dado';
  return num(2).format(spi);
}
/** "2026-11-09" para "09/11/2026". */
export function formatData(d: ISODate | null | undefined): string {
  if (!d) return '';
  const [a, m, dia] = d.slice(0, 10).split('-');
  if (!a || !m || !dia) return d;
  return `${dia}/${m}/${a}`;
}
/** "2026-11-09" para "09/11". */
export function formatDiaMes(d: ISODate | null | undefined): string {
  if (!d) return '';
  const [, m, dia] = d.slice(0, 10).split('-');
  return `${dia}/${m}`;
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2026-11-09" para "nov/26". */
export function formatMesAno(d: ISODate): string {
  const [a, m] = d.split('-');
  return `${MESES[Number(m) - 1] ?? m}/${a?.slice(2)}`;
}
/** Converte ISO em Date local (meio-dia, sem efeito de fuso). */
export function isoParaDate(d: ISODate): Date {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, dia ?? 1, 12);
}
/** Date para ISO "YYYY-MM-DD". */
export function dateParaIso(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Diferença em dias corridos (b - a). */
export function diasEntre(a: ISODate, b: ISODate): number {
  return Math.round((isoParaDate(b).getTime() - isoParaDate(a).getTime()) / 86_400_000);
}
