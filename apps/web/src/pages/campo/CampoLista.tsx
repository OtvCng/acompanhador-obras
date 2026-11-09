import { Link } from 'react-router-dom';
import { ChevronRight, HardHat, MapPin } from 'lucide-react';
import { etapasEmAndamento, indicadoresObra, NOMES_TIPO, type Indicadores, type ISODate, type Obra } from '@obras/shared';
import { useObras, useObrasVisiveis } from '@/store';
import { BarraProgresso, EstadoVazio, Selo } from '@/components/campo/ui';
import { NOMES_STATUS, formatarPctInteiro } from '@/components/campo/formatos';
import { SAUDE, SaudeBadge } from '@/components/ui';

function indicadoresSeguros(obra: Obra, hoje: ISODate): Indicadores | null {
  try {
    return indicadoresObra(obra, hoje);
  } catch {
    return null;
  }
}

function etapaAtual(obra: Obra, hoje: ISODate): string | null {
  try {
    const e = etapasEmAndamento(obra, hoje);
    return e.length ? e.slice(0, 2).map((x) => x.nome).join(', ') + (e.length > 2 ? ` e mais ${e.length - 2}` : '') : null;
  } catch {
    return null;
  }
}

export default function CampoLista() {
  const { usuarioAtual, hoje } = useObras();
  const obras = useObrasVisiveis();
  const ehEncarregado = usuarioAtual.perfil === 'encarregado';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Campo</h1>
        <p className="text-sm text-muted">{ehEncarregado ? 'Suas obras. Toque numa obra para lançar o avanço.' : 'Obras visíveis para você. Toque numa obra para lançar o avanço.'}</p>
      </div>

      {obras.length === 0 ? (
        <EstadoVazio icone={<HardHat className="size-8" />} titulo="Nenhuma obra por aqui">
          {ehEncarregado ? 'Ainda não há obras com você como encarregado.' : 'Ainda não há obras visíveis para o seu perfil.'}
        </EstadoVazio>
      ) : (
        <ul className="space-y-3">
          {obras.map((o) => {
            const ind = indicadoresSeguros(o, hoje);
            const faixa = o.status === 'concluida' ? 'concluida' : (ind?.faixa ?? 'nao_iniciada');
            const realizado = (ind?.realizado ?? 0) * 100;
            const atual = etapaAtual(o, hoje);
            return (
              <li key={o.id}>
                <Link to={`/campo/${o.id}`} className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition active:bg-gray-50 hover:border-gray-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">{o.nome}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">
                          {NOMES_TIPO[o.tipo]} · {o.cidade}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-gray-400" aria-hidden />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <BarraProgresso valor={realizado} cor={SAUDE[faixa].bg} />
                    <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{formatarPctInteiro(realizado)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SaudeBadge faixa={faixa} />
                    {o.status !== 'em_andamento' && o.status !== 'concluida' && <Selo>{NOMES_STATUS[o.status]}</Selo>}
                    {ind?.alertaCaixa && <Selo tom="vermelho">Desvio acima de 10 pp</Selo>}
                    {atual && <span className="truncate text-xs text-muted">Agora: {atual}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
