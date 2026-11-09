import type { FaixaSaude } from '@obras/shared';
import { ORDEM_FAIXAS, SAUDE } from '@/components/ui/SaudeBadge';
import { cn } from '@/lib/utils';

/** Barra segmentada com a contagem de obras por faixa de saúde, mais legenda com rótulo e número. */
export function DistribuicaoSaude({
  contagem,
  selecionada,
  onSelecionar,
}: {
  contagem: Partial<Record<FaixaSaude, number>>;
  selecionada?: FaixaSaude | null;
  onSelecionar?: (f: FaixaSaude | null) => void;
}) {
  const total = ORDEM_FAIXAS.reduce((s, f) => s + (contagem[f] ?? 0), 0);
  if (total === 0) return <div className="text-sm text-muted">Nenhuma obra para distribuir.</div>;
  const faixas = ORDEM_FAIXAS.filter((f) => (contagem[f] ?? 0) > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {faixas.map((f) => (
          <div
            key={f}
            className={cn(SAUDE[f].bg, 'h-full first:rounded-l-full last:rounded-r-full', selecionada && selecionada !== f && 'opacity-30')}
            style={{ width: `${((contagem[f] ?? 0) / total) * 100}%` }}
            title={`${SAUDE[f].rotulo}: ${contagem[f]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ORDEM_FAIXAS.map((f) => {
          const n = contagem[f] ?? 0;
          return (
            <button
              key={f}
              type="button"
              disabled={!onSelecionar || n === 0}
              onClick={() => onSelecionar?.(selecionada === f ? null : f)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-gray-700 enabled:cursor-pointer enabled:hover:bg-gray-100',
                selecionada === f && 'bg-gray-100 ring-1 ring-border',
                n === 0 && 'opacity-40',
              )}
            >
              <span className={cn('size-2.5 rounded-full', SAUDE[f].bg)} />
              {SAUDE[f].rotulo}
              <span className="font-semibold text-gray-900">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
