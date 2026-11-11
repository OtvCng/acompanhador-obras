import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarRange, ClipboardList, Grid3x3, LayoutDashboard, Receipt } from 'lucide-react';
import { indicadoresObra } from '@obras/shared';
import { useObra, useObras, useObrasVisiveis, podeVerValores } from '@/store';
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Cabecalho } from './obra/Cabecalho';
import { ExcluirObra } from './obra/ExcluirObra';
import { AbaVisaoGeral } from './obra/AbaVisaoGeral';
import { AbaCronograma } from './obra/AbaCronograma';
import { AbaMatriz } from './obra/AbaMatriz';
import { AbaFinanceiro } from './obra/AbaFinanceiro';
import { AbaApontamentos } from './obra/AbaApontamentos';
import AbaGastos from '@/pages/obra/AbaGastos';

const ABAS = ['visao-geral', 'cronograma', 'matriz', 'financeiro', 'gastos', 'apontamentos'] as const;
type Aba = (typeof ABAS)[number];

/**
 * Aba Apontamentos ESCONDIDA por ora (pedido do Otavio, 10/11: "o trabalho não vai ser diretamente deste jeito").
 * Código e dados ficam guardados; true volta a mostrar. Link antigo ?aba=apontamentos cai na Visão geral.
 */
const MOSTRAR_ABA_APONTAMENTOS = false;
/**
 * Aba Matriz ESCONDIDA (decisão do Otavio, 11/11, plano 2026-11-11-16-20): a grade "Por andar" do Cronograma
 * a substitui e é editável. O arquivo fica; true volta a mostrar. Link antigo ?aba=matriz abre o Cronograma.
 */
const MOSTRAR_ABA_MATRIZ = false;

export default function ObraDetalhePage() {
  const { id } = useParams();
  const obra = useObra(id);
  const visiveis = useObrasVisiveis();
  const { usuarioAtual, hoje } = useObras();
  const [params, setParams] = useSearchParams();
  const verValores = podeVerValores(usuarioAtual.perfil);
  const ind = useMemo(() => (obra ? indicadoresObra(obra, hoje) : null), [obra, hoje]);

  // Financeiro e Gastos mostram R$: seguem podeVerValores (hoje todos veem; a flag OCULTAR_VALORES_ENCARREGADO religa a restrição).
  const abasPermitidas = ABAS.filter(
    (a) => ((a !== 'financeiro' && a !== 'gastos') || verValores) && (a !== 'apontamentos' || MOSTRAR_ABA_APONTAMENTOS) && (a !== 'matriz' || MOSTRAR_ABA_MATRIZ),
  );
  const pedidaUrl = params.get('aba') as Aba | null;
  const pedida: Aba | null = pedidaUrl === 'matriz' && !MOSTRAR_ABA_MATRIZ ? 'cronograma' : pedidaUrl;
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
      <ExcluirObra obra={obra} />
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
          {MOSTRAR_ABA_MATRIZ && (
            <TabsTrigger value="matriz">
              <Grid3x3 /> Matriz
            </TabsTrigger>
          )}
          {verValores && (
            <TabsTrigger value="financeiro">
              <BarChart3 /> Financeiro
            </TabsTrigger>
          )}
          {verValores && (
            <TabsTrigger value="gastos">
              <Receipt /> Gastos
            </TabsTrigger>
          )}
          {MOSTRAR_ABA_APONTAMENTOS && (
            <TabsTrigger value="apontamentos">
              <ClipboardList /> Apontamentos
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="visao-geral">
          <AbaVisaoGeral obra={obra} ind={ind} />
        </TabsContent>
        <TabsContent value="cronograma">
          <AbaCronograma obra={obra} />
        </TabsContent>
        {MOSTRAR_ABA_MATRIZ && (
          <TabsContent value="matriz">
            <AbaMatriz obra={obra} />
          </TabsContent>
        )}
        {verValores && (
          <TabsContent value="financeiro">
            <AbaFinanceiro obra={obra} />
          </TabsContent>
        )}
        {verValores && (
          <TabsContent value="gastos">
            <AbaGastos obra={obra} />
          </TabsContent>
        )}
        {MOSTRAR_ABA_APONTAMENTOS && (
          <TabsContent value="apontamentos">
            <AbaApontamentos obra={obra} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
