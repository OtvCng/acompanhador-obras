import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, CircleHelp, Gauge, Percent, Target, TrendingDown, Wallet } from 'lucide-react';
import {
  ETAPAS_CAIXA,
  curvaS,
  etapasEmAndamento,
  etapasForaDaFaixa,
  fimPrevisto,
  indicadoresEtapa,
  type Indicadores,
  type Obra,
} from '@obras/shared';
import { useObras, podeVerValores } from '@/store';
import { BarraDupla, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, SaudeBadge } from '@/components/ui';
import { CurvaSChart, type ModoCurva } from '@/components/charts';
import { formatBRLCompacto, formatData, formatPct, formatPctFracao, formatPP, formatSPI } from '@/lib/format';
import { Kpi, corBarra } from './comum';
import { cn } from '@/lib/utils';

export function AbaVisaoGeral({ obra, ind }: { obra: Obra; ind: Indicadores }) {
  const { hoje, usuarioAtual } = useObras();
  const verValores = podeVerValores(usuarioAtual.perfil);
  const [modo, setModo] = useState<ModoCurva>('fisica');
  const modoEfetivo: ModoCurva = verValores ? modo : 'fisica';

  const pontos = useMemo(() => curvaS(obra, hoje), [obra, hoje]);
  const emAndamento = useMemo(() => etapasEmAndamento(obra, hoje).map((e) => ({ e, i: indicadoresEtapa(obra, e, hoje) })), [obra, hoje]);
  const etapasComAlerta = useMemo(
    () => obra.etapas.map((e) => ({ e, i: indicadoresEtapa(obra, e, hoje) })).filter((x) => x.i.alertaCaixa),
    [obra, hoje],
  );
  const foraFaixa = useMemo(() => etapasForaDaFaixa(obra), [obra]);
  const naoConfirmadas = obra.etapas.flatMap((e) => e.atividades.filter((a) => !a.duracaoConfirmada));
  const estimadas = obra.etapas.filter((e) => e.valorEstimado);
  const nomeEtapa = (c: number) => obra.etapas.find((e) => e.codigo === c)?.nome ?? ETAPAS_CAIXA.find((e) => e.codigo === c)?.nome ?? `Etapa ${c}`;
  const fim = fimPrevisto(obra);

  const alertas: { tom: 'vermelho' | 'amarelo' | 'cinza'; icone: typeof AlertTriangle; titulo: string; detalhe: string }[] = [];
  if (ind.alertaCaixa)
    alertas.push({
      tom: 'vermelho',
      icone: TrendingDown,
      titulo: `Obra com desvio de ${formatPP(ind.desvioPP)} (critério Caixa: mais de 10 pp)`,
      detalhe: `Realizado ${formatPctFracao(ind.realizado)} contra ${formatPctFracao(ind.planejado)} planejado pela baseline.`,
    });
  for (const { e, i } of etapasComAlerta)
    alertas.push({ tom: 'amarelo', icone: TrendingDown, titulo: `${e.nome}: desvio de ${formatPP(i.desvioPP)}`, detalhe: 'Etapa com desvio maior que 10 pp contra a baseline.' });
  if (verValores)
    for (const f of foraFaixa)
      alertas.push({
        tom: 'amarelo',
        icone: AlertTriangle,
        titulo: `${nomeEtapa(f.codigo)}: ${formatPct(f.percentual)} do orçamento`,
        detalhe: `Fora da faixa de referência Caixa (${formatPct(f.faixaMin, 0)} a ${formatPct(f.faixaMax, 0)}).`,
      });
  if (naoConfirmadas.length)
    alertas.push({
      tom: 'cinza',
      icone: CircleHelp,
      titulo: `${naoConfirmadas.length} atividade${naoConfirmadas.length > 1 ? 's' : ''} com duração NÃO CONFIRMADO`,
      detalhe: `Duração estimada pelo modelo, aguardando validação: ${naoConfirmadas.slice(0, 4).map((a) => a.nome).join(', ')}${naoConfirmadas.length > 4 ? '...' : ''}.`,
    });
  if (verValores && estimadas.length)
    alertas.push({
      tom: 'cinza',
      icone: CircleHelp,
      titulo: `${estimadas.length} etapa${estimadas.length > 1 ? 's' : ''} com valor estimado`,
      detalhe: 'Valor distribuído pelo ponto médio da faixa Caixa (estimativa). Ajuste na aba Financeiro.',
    });

  return (
    <div className="space-y-4">
      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3', verValores ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
        <Kpi titulo="Realizado" valor={formatPctFracao(ind.realizado)} detalhe="físico ponderado por valor" icone={Percent} tom="azul" />
        <Kpi titulo="Planejado até hoje" valor={formatPctFracao(ind.planejado)} detalhe={obra.baselines.length ? 'pela baseline vigente' : 'sem baseline'} icone={Target} />
        <Kpi
          titulo="SPI"
          valor={formatSPI(ind.spi)}
          detalhe={<SaudeBadge faixa={ind.faixa} />}
          icone={Gauge}
          tom={ind.faixa === 'atrasada' ? 'vermelho' : ind.faixa === 'atencao' ? 'amarelo' : ind.faixa === 'nao_iniciada' ? 'neutro' : 'verde'}
        />
        <Kpi
          titulo="Desvio"
          valor={formatPP(ind.desvioPP)}
          detalhe={ind.alertaCaixa ? 'acima de 10 pp (alerta Caixa)' : 'dentro do limite de 10 pp'}
          icone={AlertTriangle}
          tom={ind.alertaCaixa ? 'vermelho' : 'neutro'}
        />
        <Kpi titulo="Fim previsto" valor={formatData(fim)} detalhe={obra.baselines.length ? `baseline v${obra.baselines.at(-1)!.versao}` : 'datas atuais'} icone={CalendarCheck} />
        {verValores && (
          <Kpi titulo="Valor agregado" valor={formatBRLCompacto(ind.valorAgregado)} detalhe={`planejado: ${formatBRLCompacto(ind.valorPlanejado)}`} icone={Wallet} />
        )}
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Curva S</CardTitle>
            <CardDescription>
              Previsto pela baseline x realizado acumulado {modoEfetivo === 'fisica' ? '(% físico)' : '(R$ de valor agregado)'}
            </CardDescription>
          </div>
          {verValores && (
            <div className="flex rounded-md border border-border p-0.5">
              {(['fisica', 'financeira'] as const).map((m) => (
                <Button key={m} size="sm" variant={modo === m ? 'secondary' : 'ghost'} className="h-7" onClick={() => setModo(m)}>
                  {m === 'fisica' ? 'Física (%)' : 'Financeira (R$)'}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <CurvaSChart pontos={pontos} hoje={hoje} modo={modoEfetivo} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Etapas em andamento</CardTitle>
            <CardDescription>Com algum item programado para {formatData(hoje)}.</CardDescription>
          </CardHeader>
          <CardContent>
            {emAndamento.length === 0 ? (
              <div className="text-sm text-muted">Nenhuma etapa em andamento na data de referência.</div>
            ) : (
              <ul className="space-y-3">
                {emAndamento.map(({ e, i }) => (
                  <li key={e.codigo}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-gray-900">
                        {e.codigo}. {e.nome}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {formatPctFracao(i.realizado)} / {formatPctFracao(i.planejado)} · SPI {formatSPI(i.spi)}
                        <SaudeBadge faixa={i.faixa} />
                      </span>
                    </div>
                    <BarraDupla realizado={i.realizado * 100} planejado={i.planejado * 100} corRealizado={corBarra(i.faixa)} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Desvios, faixas Caixa e dados ainda não confirmados.</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <div className="rounded-lg bg-saude-verde/5 px-3 py-4 text-sm text-saude-verde">Nenhum alerta para esta obra.</div>
            ) : (
              <ul className="space-y-2">
                {alertas.map((a, k) => {
                  const Icone = a.icone;
                  return (
                    <li
                      key={k}
                      className={cn('flex gap-3 rounded-lg border px-3 py-2.5', {
                        'border-saude-vermelho/30 bg-saude-vermelho/5': a.tom === 'vermelho',
                        'border-saude-amarelo/30 bg-saude-amarelo/5': a.tom === 'amarelo',
                        'border-border bg-gray-50': a.tom === 'cinza',
                      })}
                    >
                      <Icone
                        className={cn('mt-0.5 size-4 shrink-0', {
                          'text-saude-vermelho': a.tom === 'vermelho',
                          'text-saude-amarelo': a.tom === 'amarelo',
                          'text-saude-cinza': a.tom === 'cinza',
                        })}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {a.titulo} {a.tom === 'cinza' && <Badge variant="estimativa">estimativa</Badge>}
                        </div>
                        <div className="text-xs text-muted">{a.detalhe}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
