import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 0..100 */
  value?: number;
  indicatorClassName?: string;
}

export const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...p }, ref) => {
    const v = Math.max(0, Math.min(100, value));
    return (
      <ProgressPrimitive.Root ref={ref} value={v} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-gray-100', className)} {...p}>
        <ProgressPrimitive.Indicator className={cn('h-full bg-accent transition-all', indicatorClassName)} style={{ width: `${v}%` }} />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = 'Progress';

/**
 * Barra dupla: planejado (faixa cinza com marcador escuro) x realizado (barra colorida). Valores 0..100.
 */
export function BarraDupla({
  realizado,
  planejado,
  corRealizado = 'bg-accent',
  className,
}: {
  realizado: number;
  planejado: number;
  corRealizado?: string;
  className?: string;
}) {
  const r = Math.max(0, Math.min(100, realizado));
  const p = Math.max(0, Math.min(100, planejado));
  return (
    <div
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100', className)}
      role="img"
      aria-label={`Realizado ${r.toFixed(0)}%, planejado ${p.toFixed(0)}%`}
    >
      <div className="absolute inset-y-0 left-0 bg-gray-300" style={{ width: `${p}%` }} />
      <div className={cn('absolute inset-y-0.5 left-0 rounded-full', corRealizado)} style={{ width: `${r}%` }} />
      {p > 0 && <div className="absolute inset-y-0 w-0.5 bg-gray-700" style={{ left: `calc(${p}% - 1px)` }} />}
    </div>
  );
}
