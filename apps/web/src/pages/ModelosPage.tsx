/**
 * Modelos (Telas-Campo): /modelos lista os 6 modelos; /modelos/:tipo detalha e edita (diretor e engenheiro).
 * Encarregado não vê Modelos (Q5): bloqueado também pelo endereço.
 */
import { Link, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { NOMES_TIPO, type TipoObra } from '@obras/shared';
import { useObras } from '@/store';
import { EstadoVazio } from '@/components/campo/ui';
import ModelosLista from './modelos/ModelosLista';
import ModeloDetalhe from './modelos/ModeloDetalhe';

export default function ModelosPage() {
  const { tipo } = useParams();
  const { usuarioAtual } = useObras();

  if (usuarioAtual.perfil === 'encarregado') {
    return (
      <div className="mx-auto max-w-xl py-8">
        <EstadoVazio
          icone={<Lock className="size-8" />}
          titulo="Modelos restritos"
          acao={
            <Link to="/campo" className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">
              Ir para o Campo
            </Link>
          }
        >
          O perfil encarregado não acessa os modelos de obra. Peça ao engenheiro ou ao diretor; você pode lançar o avanço das suas obras na tela Campo.
        </EstadoVazio>
      </div>
    );
  }

  if (tipo === undefined) return <ModelosLista />;
  if (!(tipo in NOMES_TIPO)) return <EstadoVazio titulo="Tipo de obra desconhecido">Volte para a lista de modelos.</EstadoVazio>;
  return <ModeloDetalhe key={tipo} tipo={tipo as TipoObra} />;
}
