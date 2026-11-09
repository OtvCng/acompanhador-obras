import type { FaixaSaude } from '@obras/shared';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export type CorSaude = 'verde' | 'amarelo' | 'vermelho' | 'cinza' | 'azul';

/** Régua Q15: rótulo e cor de cada faixa de saúde. */
export const SAUDE: Record<FaixaSaude, { rotulo: string; cor: CorSaude; hex: string; bg: string; text: string }> = {
  adiantada: { rotulo: 'Adiantada', cor: 'verde', hex: '#16a34a', bg: 'bg-saude-verde', text: 'text-saude-verde' },
  no_prazo: { rotulo: 'No prazo', cor: 'verde', hex: '#16a34a', bg: 'bg-saude-verde', text: 'text-saude-verde' },
  atencao: { rotulo: 'Atenção', cor: 'amarelo', hex: '#d97706', bg: 'bg-saude-amarelo', text: 'text-saude-amarelo' },
  atrasada: { rotulo: 'Atrasada', cor: 'vermelho', hex: '#dc2626', bg: 'bg-saude-vermelho', text: 'text-saude-vermelho' },
  nao_iniciada: { rotulo: 'Não iniciada', cor: 'cinza', hex: '#5a5b5f', bg: 'bg-saude-cinza', text: 'text-saude-cinza' },
  concluida: { rotulo: 'Concluída', cor: 'azul', hex: '#2563eb', bg: 'bg-saude-azul', text: 'text-saude-azul' },
};

/** Ordem de exibição: o que mais precisa de atenção primeiro. */
export const ORDEM_FAIXAS: FaixaSaude[] = ['atrasada', 'atencao', 'no_prazo', 'adiantada', 'nao_iniciada', 'concluida'];

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
