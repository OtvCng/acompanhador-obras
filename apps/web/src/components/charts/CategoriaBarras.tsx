import { formatBRL, formatPct } from '@/lib/format';
import { COR_GASTO } from './CustoMensalChart';

/** Barras horizontais de gasto por categoria (valor e % do total). HTML puro: lê bem em 390 px. */
export function CategoriaBarras({ itens }: { itens: { rotulo: string; valor: number; pct: number }[] }) {
  const comValor = itens.filter((i) => i.valor > 0);
  if (comValor.length === 0) return <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">Nenhum gasto lançado.</div>;
  const max = Math.max(...comValor.map((i) => i.valor));
  return (
    <ul className="space-y-3">
      {comValor.map((i) => (
        <li key={i.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-gray-800">{i.rotulo}</span>
            <span className="shrink-0 tabular-nums text-gray-900">
              <b>{formatBRL(i.valor)}</b> <span className="text-xs text-muted">{formatPct(i.pct)}</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, backgroundColor: COR_GASTO }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
