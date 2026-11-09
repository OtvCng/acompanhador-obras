/**
 * Modelos (Telas-Campo): /modelos lista os 6 modelos; /modelos/:tipo detalha e edita (diretor e engenheiro).
 */
import { useParams } from 'react-router-dom';
import { NOMES_TIPO, type TipoObra } from '@obras/shared';
import ToasterCampo from '@/components/campo/ToasterCampo';
import { EstadoVazio } from '@/components/campo/ui';
import ModelosLista from './modelos/ModelosLista';
import ModeloDetalhe from './modelos/ModeloDetalhe';

export default function ModelosPage() {
  const { tipo } = useParams();
  const valido = tipo !== undefined && tipo in NOMES_TIPO;
  return (
    <>
      <ToasterCampo />
      {tipo === undefined ? <ModelosLista /> : valido ? <ModeloDetalhe key={tipo} tipo={tipo as TipoObra} /> : <EstadoVazio titulo="Tipo de obra desconhecido">Volte para a lista de modelos.</EstadoVazio>}
    </>
  );
}
