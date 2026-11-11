/** Peças de custo (orçado x gasto real) usadas pelo Financeiro, Painel e lista de Obras. Arquivo da Gestão. */
import { useMemo } from 'react';
import { indicadoresCustoObra, type FaixaCusto, type IndicadoresCusto, type Obra } from '@obras/shared';
import { useObras } from '@/store';
import { Badge } from '@/components/ui';
import { formatBRL, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';

export type { FaixaCusto };

/** Rótulos e cores da faixa de custo. Mesmas cores da régua de saúde (verde/amarelo/vermelho/cinza). */
export const CUSTO: Record<FaixaCusto, { rotulo: string; cor: 'verde' | 'amarelo' | 'vermelho' | 'cinza'; text: string; bg: string; borderL: string }> = {
  dentro: { rotulo: 'Dentro do orçado', cor: 'verde', text: 'text-saude-verde', bg: 'bg-saude-verde', borderL: 'border-l-saude-verde' },
  atencao: { rotulo: 'Perto do limite', cor: 'amarelo', text: 'text-saude-amarelo', bg: 'bg-saude-amarelo', borderL: 'border-l-saude-amarelo' },
  acima: { rotulo: 'Estourou o orçado', cor: 'vermelho', text: 'text-saude-vermelho', bg: 'bg-saude-vermelho', borderL: 'border-l-saude-vermelho' },
  sem_gastos: { rotulo: 'Sem gastos', cor: 'cinza', text: 'text-gray-600', bg: 'bg-saude-cinza', borderL: 'border-l-saude-cinza' },
};

/** Ordem do que mais preocupa para o que menos preocupa. */
export const ORDEM_CUSTO: FaixaCusto[] = ['acima', 'atencao', 'dentro', 'sem_gastos'];

export function CustoBadge({ faixa, className, curto }: { faixa: FaixaCusto; className?: string; curto?: boolean }) {
  const s = CUSTO[faixa];
  const rotulo = curto ? { dentro: 'Dentro', atencao: 'Perto do limite', acima: 'Estourou', sem_gastos: 'Sem gastos' }[faixa] : s.rotulo;
  return (
    <Badge variant={s.cor} className={className}>
      <span className={cn('size-1.5 rounded-full', s.bg)} />
      {rotulo}
    </Badge>
  );
}

/** Cor do desvio de custo: segue a faixa; cinza sem gastos. */
export function corCusto(faixa: FaixaCusto): string {
  return CUSTO[faixa].text;
}

/**
 * REGRA DE SALDO (decisão do Otavio, 10/11): o orçado é um saldo e cada gasto desconta dele.
 * Resumo curto do uso do orçado: "6,3% usado" ou, se passou, "+4,0% acima".
 */
export function formatDesvioPct(c: Pick<IndicadoresCusto, 'gasto' | 'orcado' | 'consumido' | 'estouro'>): string {
  if (c.gasto <= 0) return 'sem gastos';
  if (c.consumido == null) return 'sem orçado';
  if (c.estouro > 0.005) return `+${formatPct((c.consumido - 1) * 100)} acima`;
  return `${pctPequeno(c.consumido)} usado`;
}

/** Frase do saldo: "Saldo de R$ X (Y% do orçado ainda disponível)" ou "Estourou R$ X". */
export function fraseSaldo(c: IndicadoresCusto): { titulo: string; valor: string; detalhe: string; cor: string } {
  if (c.estouro > 0.005) {
    return {
      titulo: 'Estourou o orçado',
      valor: formatBRL(c.estouro),
      detalhe: `gastou ${formatPct(((c.consumido ?? 1) - 1) * 100)} a mais que o orçado`,
      cor: 'text-saude-vermelho',
    };
  }
  return {
    titulo: 'Saldo disponível',
    valor: formatBRL(c.saldo),
    detalhe: c.orcado > 0 ? `${pctPequeno(c.saldo / c.orcado)} do orçado ainda livre` : 'sem orçado',
    cor: c.faixa === 'atencao' ? 'text-saude-amarelo' : 'text-gray-900',
  };
}

/** % (fração) sem esconder valores pequenos: 0,0005 vira "< 0,1%" e 0,9995 vira "> 99,9%", não "0,0%"/"100,0%". */
export function pctPequeno(f: number): string {
  if (f > 0 && f < 0.001) return '< 0,1%';
  if (f > 0.999 && f < 1) return '> 99,9%';
  return formatPct(f * 100);
}

/** Barrinha de uso do orçado (0..100%+), na cor da faixa. */
export function BarraUso({ c, className }: { c: IndicadoresCusto; className?: string }) {
  const pct = Math.min(100, Math.max(0, (c.consumido ?? 0) * 100));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-gray-100', className)} aria-hidden>
      <div className={cn('h-full rounded-full', c.gasto > 0 ? CUSTO[c.faixa].bg : 'bg-transparent')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Diferença final (obra concluída): gasto − orçado, em R$ e % do orçado (pct em 0..100). */
export function diferencaFinal(orcado: number, gasto: number) {
  const dif = gasto - orcado;
  const pct = orcado > 0 ? (dif / orcado) * 100 : null;
  const cor = Math.abs(dif) < 0.5 ? 'text-gray-700' : dif > 0 ? 'text-saude-vermelho' : 'text-saude-verde';
  const sinal = dif > 0.5 ? '+' : dif < -0.5 ? '-' : '';
  return { dif, pct, cor, pctTxt: pct == null ? '-' : `${sinal}${formatPct(Math.abs(pct))}`, difTxt: `${sinal}${formatBRL(Math.abs(dif))}` };
}

/** Indicadores de custo por obra (memorizado). */
export function useCustos(obras: Obra[]): Map<string, IndicadoresCusto> {
  const { hoje } = useObras();
  return useMemo(() => new Map(obras.map((o) => [o.id, indicadoresCustoObra(o, hoje)])), [obras, hoje]);
}

/**
 * Total do portfólio pela regra de saldo: orçado e gasto de todas as obras; estouro = soma dos estouros por obra
 * (o saldo de uma obra não "paga" o estouro de outra). obrasEstouradas = quantas passaram do orçado.
 */
export function custoPortfolio(custos: Iterable<IndicadoresCusto>) {
  let orcado = 0;
  let gasto = 0;
  let estouro = 0;
  let obras = 0;
  let obrasEstouradas = 0;
  for (const c of custos) {
    orcado += c.orcado;
    gasto += c.gasto;
    estouro += c.estouro;
    if (c.gasto > 0) obras++;
    if (c.estouro > 0.005) obrasEstouradas++;
  }
  return { orcado, gasto, saldo: orcado - gasto, estouro, consumido: orcado > 0 ? gasto / orcado : null, obras, obrasEstouradas };
}
