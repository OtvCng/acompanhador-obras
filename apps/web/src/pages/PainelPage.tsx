import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Building2, CalendarClock, Gauge, Percent, Wallet } from 'lucide-react';
import { NOMES_TIPO, type FaixaSaude } from '@obras/shared';
import { useObras, useObrasVisiveis, podeVerValores } from '@/store';
import { BarraDupla, Card, CardContent, CardDescription, CardHeader, CardTitle, Dica, SaudeBadge, SaudePonto } from '@/components/ui';
import { DistribuicaoSaude } from '@/components/charts';
import { formatBRLCompacto, formatBRL, formatData, formatPctFracao, formatPP, formatSPI } from '@/lib/format';
import { Kpi, SemObras, corBarra, precisaAtencao, resumirEtapas, useResumos, type ResumoObra } from './obra/comum';
import { cn } from '@/lib/utils';

export default function PainelPage() {
  const { usuarioAtual, hoje } = useObras();
  const obras = useObrasVisiveis();
  const resumos = useResumos(obras);
  const verValores = podeVerValores(usuarioAtual.perfil);
  const [filtroFaixa, setFiltroFaixa] = useState<FaixaSaude | null>(null);

  const k = useMemo(() => {
    const ativas = resumos.filter((r) => r.obra.status === 'em_andamento');
    const base = ativas.length ? ativas : resumos;
    const orc = base.reduce((s, r) => s + r.obra.orcamentoTotal, 0);
    const fisico = orc > 0 ? base.reduce((s, r) => s + r.ind.realizado * r.obra.orcamentoTotal, 0) / orc : 0;
    const va = base.reduce((s, r) => s + r.ind.valorAgregado, 0);
    const vp = base.reduce((s, r) => s + r.ind.valorPlanejado, 0);
    const contagem: Partial<Record<FaixaSaude, number>> = {};
    for (const r of resumos) contagem[r.ind.faixa] = (contagem[r.ind.faixa] ?? 0) + 1;
    return {
      ativas: ativas.length,
      fisico,
      spi: vp > 0 ? va / vp : null,
      va,
      vp,
      atrasadas: resumos.filter((r) => r.ind.faixa === 'atrasada').length,
      caixa: resumos.filter((r) => r.ind.alertaCaixa).length,
      contagem,
    };
  }, [resumos]);

  if (obras.length === 0) return <SemObras />;

  const atencao = resumos.filter(precisaAtencao).sort((a, b) => (a.ind.spi ?? 9) - (b.ind.spi ?? 9));
  const cards = filtroFaixa ? resumos.filter((r) => r.ind.faixa === filtroFaixa) : resumos;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Portfólio</h2>
          <p className="text-sm text-muted">
            {usuarioAtual.perfil === 'diretor' ? 'Todas as obras' : 'Obras sob sua responsabilidade'} · posição em {formatData(hoje)}
          </p>
        </div>
      </div>

      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3', verValores ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
        <Kpi titulo="Obras ativas" valor={k.ativas} detalhe={`de ${resumos.length} no portfólio`} icone={Building2} tom="azul" />
        <Kpi titulo="Físico médio (ponderado)" valor={formatPctFracao(k.fisico)} detalhe="peso = orçamento de cada obra" icone={Percent} />
        <Kpi
          titulo="SPI do portfólio"
          valor={formatSPI(k.spi)}
          detalhe="valor agregado ÷ planejado"
          icone={Gauge}
          tom={k.spi == null ? 'neutro' : k.spi >= 0.95 ? 'verde' : k.spi >= 0.85 ? 'amarelo' : 'vermelho'}
        />
        <Kpi titulo="Atrasadas" valor={k.atrasadas} detalhe="SPI abaixo de 0,85" icone={CalendarClock} tom={k.atrasadas ? 'vermelho' : 'verde'} />
        <Kpi titulo="Alerta Caixa" valor={k.caixa} detalhe="desvio maior que 10 pp" icone={AlertTriangle} tom={k.caixa ? 'amarelo' : 'verde'} />
        {verValores && (
          <Kpi
            titulo="Agregado x planejado"
            valor={formatBRLCompacto(k.va)}
            detalhe={<>planejado até hoje: {formatBRLCompacto(k.vp)}</>}
            icone={Wallet}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição por saúde</CardTitle>
            <CardDescription>Clique numa faixa para filtrar os cards abaixo.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistribuicaoSaude contagem={k.contagem} selecionada={filtroFaixa} onSelecionar={setFiltroFaixa} />
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-saude-vermelho" /> Obras que precisam de atenção
            </CardTitle>
            <CardDescription>Atrasadas, em atenção ou com desvio maior que 10 pp (critério Caixa).</CardDescription>
          </CardHeader>
          <CardContent>
            {atencao.length === 0 ? (
              <div className="rounded-lg bg-saude-verde/5 px-3 py-4 text-sm text-saude-verde">Nenhuma obra exige atenção agora.</div>
            ) : (
              <ul className="divide-y divide-border">
                {atencao.map((r) => (
                  <li key={r.obra.id}>
                    <Link to={`/obras/${r.obra.id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-gray-50">
                      <SaudePonto faixa={r.ind.faixa} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">{r.obra.nome}</div>
                        <div className="truncate text-xs text-muted">
                          {resumirEtapas(r.etapasAtuais) || 'Sem etapa em andamento'}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-semibold text-gray-900">SPI {formatSPI(r.ind.spi)}</div>
                        <div className={r.ind.desvioPP < 0 ? 'text-saude-vermelho' : 'text-saude-verde'}>{formatPP(r.ind.desvioPP)}</div>
                      </div>
                      {r.ind.alertaCaixa && (
                        <Dica texto="Desvio maior que 10 pp (critério Caixa)">
                          <AlertTriangle className="size-4 text-saude-amarelo" />
                        </Dica>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Obras {filtroFaixa && <span className="font-normal text-muted">(filtro ativo)</span>}
          </h3>
          <Link to="/obras" className="text-xs font-medium text-accent hover:underline">
            Ver lista completa
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {cards.map((r) => (
            <CardObra key={r.obra.id} r={r} verValores={verValores} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardObra({ r, verValores }: { r: ResumoObra; verValores: boolean }) {
  const { obra, ind } = r;
  return (
    <Link to={`/obras/${obra.id}`} className="group block">
      <Card className={cn('h-full border-l-4 p-4 transition-shadow group-hover:shadow-md', {
        'border-l-saude-verde': ind.faixa === 'adiantada' || ind.faixa === 'no_prazo',
        'border-l-saude-amarelo': ind.faixa === 'atencao',
        'border-l-saude-vermelho': ind.faixa === 'atrasada',
        'border-l-saude-cinza': ind.faixa === 'nao_iniciada',
        'border-l-saude-azul': ind.faixa === 'concluida',
      })}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{obra.nome}</div>
            <div className="truncate text-xs text-muted">
              {NOMES_TIPO[obra.tipo]} · {obra.cidade}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {ind.alertaCaixa && (
              <Dica texto="Desvio maior que 10 pp (critério Caixa)">
                <AlertTriangle className="size-4 text-saude-amarelo" aria-label="Alerta Caixa" />
              </Dica>
            )}
            <SaudeBadge faixa={ind.faixa} />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">
          Etapa atual:{' '}
          <span className="text-gray-800">{resumirEtapas(r.etapasAtuais) || (obra.baselines.length ? 'nenhuma em andamento' : 'sem baseline')}</span>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-700">
              Realizado <b className="text-gray-900">{formatPctFracao(ind.realizado)}</b>
            </span>
            <span className="text-muted">Planejado {formatPctFracao(ind.planejado)}</span>
          </div>
          <BarraDupla realizado={ind.realizado * 100} planejado={ind.planejado * 100} corRealizado={corBarra(ind.faixa)} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
          <div>
            <div className="text-muted">SPI</div>
            <div className="font-semibold text-gray-900">{formatSPI(ind.spi)}</div>
          </div>
          <div>
            <div className="text-muted">Desvio</div>
            <div className={cn('font-semibold', ind.desvioPP < -0.05 ? 'text-saude-vermelho' : 'text-gray-900')}>{formatPP(ind.desvioPP)}</div>
          </div>
          <div>
            <div className="text-muted">Fim previsto</div>
            <div className="font-semibold text-gray-900">{formatData(r.fim)}</div>
          </div>
        </div>
        {verValores && (
          <div className="mt-2 text-xs text-muted">
            Orçamento {formatBRL(obra.orcamentoTotal)}
          </div>
        )}
      </Card>
    </Link>
  );
}
