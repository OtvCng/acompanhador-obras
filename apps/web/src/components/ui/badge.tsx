import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-accent/10 text-accent',
      secondary: 'border-transparent bg-gray-100 text-gray-700',
      outline: 'border-border text-gray-700',
      verde: 'border-transparent bg-saude-verde/10 text-saude-verde',
      amarelo: 'border-transparent bg-saude-amarelo/10 text-saude-amarelo',
      vermelho: 'border-transparent bg-saude-vermelho/10 text-saude-vermelho',
      cinza: 'border-transparent bg-gray-100 text-saude-cinza',
      azul: 'border-transparent bg-saude-azul/10 text-saude-azul',
      /** Para dados que são estimativa / NÃO CONFIRMADO. */
      estimativa: 'border-dashed border-saude-amarelo/60 bg-saude-amarelo/5 text-saude-amarelo',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
