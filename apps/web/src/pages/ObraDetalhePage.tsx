import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarRange, ClipboardList, Grid3x3, LayoutDashboard } from 'lucide-react';
import { indicadoresObra } from '@obras/shared';
import { useObra, useObras, useObrasVisiveis, podeVerValores } from '@/store';
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Cabecalho } from './obra/Cabecalho';
import { AbaVisaoGeral } from './obra/AbaVisaoGeral';
import { AbaCronograma } from './obra/AbaCronograma';
import { AbaMatriz } from './obra/AbaMatriz';
import { AbaFinanceiro } from './obra/AbaFinanceiro';
import { AbaApontamentos } from './obra/AbaApontamentos';

const ABAS = ['visao-geral', 'cronograma', 'matriz', 'financeiro', 'apontamentos'] as const;
type Aba = (typeof ABAS)[number];

export default function ObraDetalhePage() {
  const { id } = useParams();
  const obra = useObra(id);
  const visiveis = useObrasVisiveis();
  const { usuarioAtual, hoje } = useObras();
  const [params, setParams] = useSearchParams();
  const verValores = podeVerValores(usuarioAtual.perfil);
  const ind = useMemo(() => (obra ? indicadoresObra(obra, hoje) : null), [obra, hoje]);

  const abasPermitidas = ABAS.filter((a) => a !== 'financeiro' || verValores);
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = pedida && abasPermitidas.includes(pedida) ? pedida : 'visao-geral';

  if (!obra || !ind) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="font-semibold text-gray-900">Obra não encontrada</div>
        <p className="mt-1 text-sm text-muted">Ela pode ter sido removida ao restaurar os dados de exemplo.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/obras">Voltar para obras</Link>
        </Button>
      </Card>
    );
  }
  if (!visiveis.some((o) => o.id === obra.id)) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="font-semibold text-gray-900">Sem acesso a esta obra</div>
        <p className="mt-1 text-sm text-muted">O usuário selecionado não é responsável por esta obra.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/obras">Ver minhas obras</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <Cabecalho obra={obra} ind={ind} />
      <Tabs
        value={aba}
        onValueChange={(v) => {
          const p = new URLSearchParams(params);
          p.set('aba', v);
          setParams(p, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="visao-geral">
            <LayoutDashboard /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="cronograma">
            <CalendarRange /> Cronograma
          </TabsTrigger>
          <TabsTrigger value="matriz">
            <Grid3x3 /> Matriz
          </TabsTrigger>
          {verValores && (
            <TabsTrigger value="financeiro">
              <BarChart3 /> Financeiro
            </TabsTrigger>
          )}
          <TabsTrigger value="apontamentos">
            <ClipboardList /> Apontamentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visao-geral">
          <AbaVisaoGeral obra={obra} ind={ind} />
        </TabsContent>
        <TabsContent value="cronograma">
          <AbaCronograma obra={obra} />
        </TabsContent>
        <TabsContent value="matriz">
          <AbaMatriz obra={obra} />
        </TabsContent>
        {verValores && (
          <TabsContent value="financeiro">
            <AbaFinanceiro obra={obra} />
          </TabsContent>
        )}
        <TabsContent value="apontamentos">
          <AbaApontamentos obra={obra} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
