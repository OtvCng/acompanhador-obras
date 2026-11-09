import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Hammer } from 'lucide-react';
import { toast } from 'sonner';
import { useObra, useObras, useObrasVisiveis } from '@/store';
import { Aviso, BarraProgresso, EstadoVazio, Selo, cn } from '@/components/campo/ui';
import { formatarDataCurta, formatarPctInteiro } from '@/components/campo/formatos';
import { abaixoDoPrevisto, agruparItens, itensDaObra, type ItemCampo } from './itens';
import FolhaApontamento, { toastApontamento } from './FolhaApontamento';

const TODOS = '__todos__';

function LinhaItem({ x, mostrarLocal, destaque, aoAbrir }: { x: ItemCampo; mostrarLocal: boolean; destaque?: 'atrasado' | 'proximo'; aoAbrir: () => void }) {
  const { item, atividade, local } = x;
  // Vermelho: no grupo Atrasados (prazo vencido) ou em andamento abaixo do previsto.
  const vencido = destaque === 'atrasado';
  const atrasado = vencido || (destaque !== 'proximo' && abaixoDoPrevisto(x));
  return (
    <li>
      <button type="button" onClick={aoAbrir} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition active:bg-gray-50 hover:bg-gray-50">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-medium leading-snug text-gray-900">
            <span className="mr-1 text-xs font-normal text-muted">{atividade.codigo}</span>
            {atividade.nome}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            {!vencido && atrasado && <Selo tom="vermelho">atrasado</Selo>}
            <span>
              {mostrarLocal && local && local.tipo !== 'obra' && <>{local.nome} · </>}
              {formatarDataCurta(item.inicioPlanejado)} a {formatarDataCurta(item.fimPlanejado)}
              {atrasado && <span className="text-saude-vermelho"> · previsto {formatarPctInteiro(x.planejado)}</span>}
            </span>
          </div>
          {destaque !== 'proximo' && <BarraProgresso valor={item.percentual} className="mt-2 h-1.5" cor={atrasado ? 'bg-saude-vermelho' : item.percentual >= 100 ? 'bg-saude-azul' : 'bg-accent'} />}
        </div>
        <span className={cn('w-12 shrink-0 text-right text-base font-semibold tabular-nums', atrasado && 'text-saude-vermelho')}>{formatarPctInteiro(item.percentual)}</span>
        <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden />
      </button>
    </li>
  );
}

function Grupo({
  titulo,
  icone,
  itens,
  vazio,
  recolhivel,
  tom,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  itens: ItemCampo[];
  vazio?: string;
  recolhivel?: boolean;
  tom?: 'vermelho';
  children: (x: ItemCampo) => ReactNode;
}) {
  const [aberto, setAberto] = useState(!recolhivel);
  if (itens.length === 0 && !vazio) return null;
  const cabecalho = (
    <>
      <span className={cn('flex items-center gap-2 text-sm font-semibold', tom === 'vermelho' ? 'text-saude-vermelho' : 'text-gray-900')}>
        {icone}
        {titulo}
      </span>
      <span className="flex items-center gap-1 text-sm text-muted">
        {itens.length}
        {recolhivel && <ChevronDown className={cn('size-4 transition-transform', aberto && 'rotate-180')} aria-hidden />}
      </span>
    </>
  );
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {recolhivel ? (
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex min-h-12 w-full items-center justify-between px-4">
          {cabecalho}
        </button>
      ) : (
        <h2 className="flex min-h-12 items-center justify-between px-4">{cabecalho}</h2>
      )}
      {aberto &&
        (itens.length === 0 ? (
          <p className="border-t border-border px-4 py-3 text-sm text-muted">{vazio}</p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">{itens.map(children)}</ul>
        ))}
    </section>
  );
}

export default function CampoObra() {
  const { obraId } = useParams();
  const store = useObras();
  const { hoje, usuarioAtual } = store;
  const obra = useObra(obraId);
  const visiveis = useObrasVisiveis();
  const [localId, setLocalId] = useState<string>(TODOS);
  const [alvoId, setAlvoId] = useState<string | null>(null);

  const itens = useMemo(() => (obra ? itensDaObra(obra, hoje) : []), [obra, hoje]);
  const locais = useMemo(() => {
    if (!obra) return [];
    const usados = new Set(itens.map((x) => x.item.localId));
    return [...obra.locais].filter((l) => usados.has(l.id)).sort((a, b) => a.ordem - b.ordem);
  }, [obra, itens]);
  const filtrados = localId === TODOS ? itens : itens.filter((x) => x.item.localId === localId);
  const grupos = useMemo(() => agruparItens(filtrados, hoje), [filtrados, hoje]);
  const alvo = alvoId ? (itens.find((x) => x.item.id === alvoId) ?? null) : null;

  if (!obra) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/campo" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
          <ArrowLeft className="size-4" aria-hidden /> Minhas obras
        </Link>
        <EstadoVazio titulo="Obra não encontrada">Ela pode ter sido removida ou os dados de exemplo ainda não foram carregados.</EstadoVazio>
      </div>
    );
  }
  const temAcesso = visiveis.some((o) => o.id === obra.id);
  const realizadoLocal = filtrados.length
    ? (() => {
        // média ponderada por valor; sem valores (ou todos zero), média simples. Só o % aparece, nunca R$.
        const pesoTotal = filtrados.reduce((s, x) => s + x.item.valorOrcado, 0);
        return pesoTotal > 0
          ? filtrados.reduce((s, x) => s + x.item.percentual * x.item.valorOrcado, 0) / pesoTotal
          : filtrados.reduce((s, x) => s + x.item.percentual, 0) / filtrados.length;
      })()
    : 0;
  const mostrarLocal = localId === TODOS;
  const abrir = (x: ItemCampo) => () => setAlvoId(x.item.id);

  const salvar = (a: { itemId: string; percentualNovo: number; observacao?: string; fotos: string[] }) => {
    const nome = alvo ? `${alvo.atividade.nome}${alvo.local && alvo.local.tipo !== 'obra' ? ` (${alvo.local.nome})` : ''}` : 'Item';
    try {
      store.lancarApontamento({ obraId: obra.id, ...a });
      setAlvoId(null);
      toastApontamento(nome, a.percentualNovo);
    } catch (e) {
      toast.error('Não foi possível salvar o apontamento.', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <div>
        <Link to="/campo" className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm text-muted">
          <ArrowLeft className="size-4" aria-hidden /> Minhas obras
        </Link>
        <h1 className="text-xl font-semibold leading-tight text-gray-900">{obra.nome}</h1>
        <div className="mt-2 flex items-center gap-3">
          <BarraProgresso valor={realizadoLocal} />
          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatarPctInteiro(realizadoLocal)}</span>
        </div>
        <div className="mt-1 text-xs text-muted">{localId === TODOS ? 'Avanço da obra' : `Avanço em ${locais.find((l) => l.id === localId)?.nome ?? 'local'}`}</div>
      </div>

      {!temAcesso && (
        <Aviso titulo="Esta obra não está atribuída a você">
          Você está vendo por link direto. Os lançamentos ficam registrados no seu nome ({usuarioAtual.nome}).
        </Aviso>
      )}
      {obra.baselines.length === 0 && (
        <Aviso tom="azul" titulo="Obra em planejamento">
          Ainda não há baseline congelada, então não há régua de atraso. Os lançamentos são registrados normalmente.
        </Aviso>
      )}

      {locais.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Local">
          <div className="flex w-max gap-2 pb-1">
            {[{ id: TODOS, nome: 'Todos' }, ...locais].map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={localId === l.id}
                onClick={() => setLocalId(l.id)}
                className={cn(
                  'min-h-11 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
                  localId === l.id ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-gray-700 active:bg-gray-100',
                )}
              >
                {l.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {itens.length === 0 ? (
        <EstadoVazio titulo="Esta obra ainda não tem itens">Os itens aparecem quando a obra é gerada a partir de um modelo.</EstadoVazio>
      ) : (
        <div className="space-y-3">
          <Grupo titulo="Em andamento" icone={<Hammer className="size-4" aria-hidden />} itens={grupos.andamento} vazio="Nada em andamento neste local.">
            {(x) => <LinhaItem key={x.item.id} x={x} mostrarLocal={mostrarLocal} aoAbrir={abrir(x)} />}
          </Grupo>
          <Grupo titulo="Começam nos próximos 7 dias" icone={<CalendarClock className="size-4" aria-hidden />} itens={grupos.proximos} vazio="Nada previsto para começar nos próximos 7 dias.">
            {(x) => <LinhaItem key={x.item.id} x={x} mostrarLocal={mostrarLocal} destaque="proximo" aoAbrir={abrir(x)} />}
          </Grupo>
          <Grupo titulo="Atrasados" tom="vermelho" icone={<AlertTriangle className="size-4" aria-hidden />} itens={grupos.atrasados}>
            {(x) => <LinhaItem key={x.item.id} x={x} mostrarLocal={mostrarLocal} destaque="atrasado" aoAbrir={abrir(x)} />}
          </Grupo>
          <Grupo titulo="Concluídos" icone={<CheckCircle2 className="size-4 text-saude-azul" aria-hidden />} itens={grupos.concluidos} recolhivel>
            {(x) => <LinhaItem key={x.item.id} x={x} mostrarLocal={mostrarLocal} aoAbrir={abrir(x)} />}
          </Grupo>
        </div>
      )}

      <FolhaApontamento obra={obra} alvo={alvo} hoje={hoje} aoFechar={() => setAlvoId(null)} aoSalvar={salvar} />
    </div>
  );
}
