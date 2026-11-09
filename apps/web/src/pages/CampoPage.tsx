/**
 * Campo (Telas-Campo), mobile-first: /campo lista as obras; /campo/:obraId lança o avanço por item.
 * Nenhum valor em R$ nesta tela.
 */
import { useParams } from 'react-router-dom';
import ToasterCampo from '@/components/campo/ToasterCampo';
import CampoLista from './campo/CampoLista';
import CampoObra from './campo/CampoObra';

export default function CampoPage() {
  const { obraId } = useParams();
  return (
    <>
      <ToasterCampo />
      {obraId ? <CampoObra key={obraId} /> : <CampoLista />}
    </>
  );
}
