import { Building, Building2, Check, Hotel, House, HousePlus, Warehouse, type LucideIcon } from 'lucide-react';
import { NOMES_TIPO, type ModeloObra, type TipoObra } from '@obras/shared';
import { cn } from '@/components/campo/ui';

const ICONES: Record<TipoObra, LucideIcon> = {
  casa_terrea: House,
  geminadas: HousePlus,
  sobrado: Building,
  predio_3_6: Building2,
  predio_7_mais: Hotel,
  comercial: Warehouse,
};

export const TIPOS = Object.keys(NOMES_TIPO) as TipoObra[];

export default function PassoTipo({
  modelos,
  valor,
  aoEscolher,
  erro,
}: {
  modelos: Partial<Record<TipoObra, ModeloObra>>;
  valor: TipoObra | null;
  aoEscolher: (t: TipoObra) => void;
  erro?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Qual é o tipo da obra?</h2>
        <p className="text-sm text-muted">O tipo define as etapas, as atividades e como a obra se divide em pavimentos ou unidades.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Tipo de obra">
        {TIPOS.map((t) => {
          const Icone = ICONES[t];
          const m = modelos[t];
          const ativo = valor === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => aoEscolher(t)}
              className={cn(
                'relative flex min-h-28 flex-col items-start gap-2 rounded-xl border bg-surface p-4 text-left shadow-sm transition',
                'hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-accent',
                ativo ? 'border-accent ring-2 ring-accent/20' : 'border-border',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className={cn('flex size-10 items-center justify-center rounded-lg', ativo ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700')}>
                  <Icone className="size-5" aria-hidden />
                </span>
                {ativo && <Check className="size-5 text-accent" aria-hidden />}
              </div>
              <div className="font-medium text-gray-900">{NOMES_TIPO[t]}</div>
              <div className="text-sm text-muted">{m?.descricao ?? 'Modelo ainda não carregado.'}</div>
              {m && (
                <div className="text-xs text-gray-500">
                  {m.etapasAtivas.length} etapas · {m.atividades.length} atividades
                </div>
              )}
            </button>
          );
        })}
      </div>
      {erro && <p className="text-sm text-saude-vermelho">{erro}</p>}
    </div>
  );
}
