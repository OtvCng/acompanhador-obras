import type { FaixaSaude } from '@obras/shared';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export type CorSaude = 'verde' | 'teal' | 'amarelo' | 'vermelho' | 'cinza' | 'azul';

interface EstiloSaude {
  rotulo: string;
  cor: CorSaude;
  hex: string;
  bg: string;
  text: string;
  /** Borda esquerda (cards) e inferior (cabeçalho). Classes literais para o Tailwind enxergar. */
  borderL: string;
  borderB: string;
}

/**
 * Régua Q15: rótulo e cor de cada faixa de saúde.
 * "Adiantada" usa verde-azulado (teal) para não se confundir com "No prazo" lado a lado.
 */
export const SAUDE: Record<FaixaSaude, EstiloSaude> = {
  adiantada: { rotulo: 'Adiantada', cor: 'teal', hex: '#0f766e', bg: 'bg-[#0f766e]', text: 'text-[#0f766e]', borderL: 'border-l-[#0f766e]', borderB: 'border-b-[#0f766e]' },
  no_prazo: { rotulo: 'No prazo', cor: 'verde', hex: '#16a34a', bg: 'bg-saude-verde', text: 'text-saude-verde', borderL: 'border-l-saude-verde', borderB: 'border-b-saude-verde' },
  atencao: { rotulo: 'Atenção', cor: 'amarelo', hex: '#d97706', bg: 'bg-saude-amarelo', text: 'text-saude-amarelo', borderL: 'border-l-saude-amarelo', borderB: 'border-b-saude-amarelo' },
  atrasada: { rotulo: 'Atrasada', cor: 'vermelho', hex: '#dc2626', bg: 'bg-saude-vermelho', text: 'text-saude-vermelho', borderL: 'border-l-saude-vermelho', borderB: 'border-b-saude-vermelho' },
  nao_iniciada: { rotulo: 'Não iniciada', cor: 'cinza', hex: '#5a5b5f', bg: 'bg-saude-cinza', text: 'text-saude-cinza', borderL: 'border-l-saude-cinza', borderB: 'border-b-saude-cinza' },
  concluida: { rotulo: 'Concluída', cor: 'azul', hex: '#2563eb', bg: 'bg-saude-azul', text: 'text-saude-azul', borderL: 'border-l-saude-azul', borderB: 'border-b-saude-azul' },
};

/** Ordem de exibição: o que mais precisa de atenção primeiro. */
export const ORDEM_FAIXAS: FaixaSaude[] = ['atrasada', 'atencao', 'no_prazo', 'adiantada', 'nao_iniciada', 'concluida'];

/** Cor do texto de desvio (pp ou R$): segue a faixa de saúde, não o sinal. Cinza quando não iniciada/concluída. */
export function corDesvio(faixa: FaixaSaude): string {
  return faixa === 'nao_iniciada' || faixa === 'concluida' ? 'text-gray-700' : SAUDE[faixa].text;
}

export function SaudeBadge({ faixa, className }: { faixa: FaixaSaude; className?: string }) {
  const s = SAUDE[faixa];
  return (
    <Badge variant={s.cor} className={className}>
      <span className={cn('size-1.5 rounded-full', s.bg)} />
      {s.rotulo}
    </Badge>
  );
}

/** Bolinha de semáforo. */
export function SaudePonto({ faixa, className }: { faixa: FaixaSaude; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', SAUDE[faixa].bg, className)} title={SAUDE[faixa].rotulo} />;
}
