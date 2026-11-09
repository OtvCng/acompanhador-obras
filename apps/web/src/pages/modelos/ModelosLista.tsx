import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { MODELOS, NOMES_TIPO, type TipoObra } from '@obras/shared';
import { useObras } from '@/store';
import { Selo, SeloNaoConfirmado } from '@/components/campo/ui';
import { TIPOS } from '../nova-obra/PassoTipo';
import { modeloFoiEditado } from './regras';

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums text-gray-900">{valor}</div>
      <div className="text-xs text-muted">{rotulo}</div>
    </div>
  );
}

export default function ModelosLista() {
  const { modelos, usuarioAtual } = useObras();
  const podeEditar = usuarioAtual.perfil !== 'encarregado';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Modelos de obra</h1>
        <p className="text-sm text-muted">
          Cada tipo de obra tem etapas (EAP Caixa), atividades, pesos e durações padrão. A Nova obra parte destes modelos.
          {!podeEditar && ' Seu perfil vê os modelos só para leitura.'}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIPOS.map((t: TipoObra) => {
          const m = modelos[t];
          const naoConf = m ? m.atividades.filter((a) => !a.duracaoConfirmada).length : 0;
          return (
            <li key={t}>
              <Link
                to={`/modelos/${t}`}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-gray-300 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-gray-900">{NOMES_TIPO[t]}</div>
                  <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden />
                </div>
                <p className="mt-1 flex-1 text-sm text-muted">{m?.descricao ?? 'Modelo ainda não carregado.'}</p>
                {m && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                      <Numero valor={m.etapasAtivas.length} rotulo="etapas ativas" />
                      <Numero valor={m.atividades.length} rotulo="atividades" />
                      <Numero valor={naoConf} rotulo={naoConf === 1 ? 'duração não confirmada' : 'durações não confirmadas'} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {naoConf > 0 && <SeloNaoConfirmado />}
                      {MODELOS[t] && modeloFoiEditado(m, MODELOS[t]) && <Selo tom="azul">editado</Selo>}
                    </div>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
