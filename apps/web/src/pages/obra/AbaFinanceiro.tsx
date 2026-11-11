/**
 * Aba Financeiro: orçado x gasto real (plano 2026-11-10-15-37, REGRA DE SALDO decidida pelo Otavio em 10/11).
 * O orçado é um saldo: cada gasto desconta dele, e só é estouro quando o gasto passa do orçado
 * (obra, etapa ou atividade). O "valor do que foi feito" fica só como informação de avanço.
 * Obra concluída mostra o bloco "Fechamento" (orçado x realizado final).
 */
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronRight, Flag, Gauge, Pencil, PiggyBank, Receipt, Wallet } from 'lucide-react';
import {
  CATEGORIAS_GASTO,
  ETAPAS_CAIXA,
  ajustarValorEtapa,
  custoMensal,
  etapasForaDaFaixa,
  gastoGeralEtapa,
  gastoPorCategoria,
  indicadoresCustoAtividade,
  indicadoresCustoEtapa,
  indicadoresCustoObra,
  type EtapaObra,
  type IndicadoresCusto,
  type Obra,
} from '@obras/shared';
import { useObras } from '@/store';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dica,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { CategoriaBarras, CustoMensalChart } from '@/components/charts';
import { formatBRL, formatData, formatPct, formatPctFracao } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Kpi } from './comum';
import { BarraUso, CustoBadge, corCusto, diferencaFinal, formatDesvioPct, fraseSaldo, pctPequeno, type FaixaCusto } from './custo';

const TOM: Record<FaixaCusto, 'verde' | 'amarelo' | 'vermelho' | 'neutro'> = { dentro: 'verde', atencao: 'amarelo', acima: 'vermelho', sem_gastos: 'neutro' };
const TODAS = 'todas';

interface LinhaEtapa {
  e: EtapaObra;
  c: IndicadoresCusto;
  atividades: { id: string; codigo: string; nome: string; c: IndicadoresCusto }[];
  geral: number;
  foraFaixa: boolean;
  ref: (typeof ETAPAS_CAIXA)[number] | undefined;
}


export function AbaFinanceiro({ obra }: { obra: Obra }) {
  const { hoje, atualizarObra } = useObras();
  const [editando, setEditando] = useState<EtapaObra | null>(null);
  const [valorTxt, setValorTxt] = useState('');
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const [etapaCat, setEtapaCat] = useState<string>(TODAS);

  const concluida = obra.status === 'concluida';
  const c = useMemo(() => indicadoresCustoObra(obra, hoje), [obra, hoje]);
  const linhas = useMemo<LinhaEtapa[]>(() => {
    const fora = new Set(etapasForaDaFaixa(obra).map((f) => f.codigo));
    return obra.etapas
      .map((e) => ({
        e,
        c: indicadoresCustoEtapa(obra, e.codigo, hoje),
        atividades: e.atividades.map((a) => ({ id: a.id, codigo: a.codigo, nome: a.nome, c: indicadoresCustoAtividade(obra, a.id, hoje) })),
        geral: gastoGeralEtapa(obra, e.codigo, hoje),
        foraFaixa: fora.has(e.codigo),
        ref: ETAPAS_CAIXA.find((r) => r.codigo === e.codigo),
      }))
      // Estouradas primeiro (maior estouro), depois as que mais usaram do orçado; empate pela ordem da EAP.
      .sort((a, b) => b.c.estouro - a.c.estouro || (b.c.consumido ?? 0) - (a.c.consumido ?? 0) || a.e.codigo - b.e.codigo);
  }, [obra, hoje]);
  const mensal = useMemo(() => custoMensal(obra, hoje), [obra, hoje]);
  const categorias = useMemo(
    () =>
      gastoPorCategoria(obra, hoje, etapaCat === TODAS ? undefined : Number(etapaCat)).map((g) => ({
        rotulo: CATEGORIAS_GASTO[g.categoria],
        valor: g.valor,
        pct: g.pct * 100,
      })),
    [obra, hoje, etapaCat],
  );
  const estimadas = obra.etapas.filter((e) => e.valorEstimado).length;
  const temBaseline = obra.baselines.length > 0;

  const valorNovo = Number(valorTxt.replace(/\./g, '').replace(',', '.'));
  const valorValido = Number.isFinite(valorNovo) && valorNovo >= 0 && valorTxt.trim() !== '';

  function abrir(e: EtapaObra) {
    setEditando(e);
    setValorTxt(e.valorOrcado.toFixed(2).replace('.', ','));
  }
  function salvar() {
    if (!editando || !valorValido) return;
    try {
      // manterTotal = false: as outras etapas (talvez ainda estimadas) não mudam; o total vira a soma.
      atualizarObra(ajustarValorEtapa(obra, editando.codigo, valorNovo, false));
      toast.success(`Valor de "${editando.nome}" atualizado.`);
      setEditando(null);
    } catch (err) {
      toast.error(`Não foi possível salvar: ${err instanceof Error ? err.message : 'erro'}`);
    }
  }
  const alternar = (codigo: number) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(codigo)) n.delete(codigo);
      else n.add(codigo);
      return n;
    });

  const saldo = fraseSaldo(c);
  const final = diferencaFinal(c.orcado, c.gasto);
  const etapasEstouradas = linhas.filter((l) => l.c.estouro > 0.005).length;
  const atividadesEstouradas = linhas.reduce((n, l) => n + l.atividades.filter((a) => a.c.estouro > 0.005).length, 0);

  return (
    <div className="space-y-4">
      {/* ---------------- 5 cards ---------------- */}
      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", concluida && "xl:grid-cols-5")}>
        <Kpi
          titulo="Orçado"
          valor={<Valor>{formatBRL(c.orcado)}</Valor>}
          detalhe={estimadas > 0 ? `${estimadas} etapa${estimadas > 1 ? 's' : ''} com valor estimado` : 'soma das etapas'}
          icone={Wallet}
        />
        <Kpi
          titulo="Gasto até agora"
          valor={<Valor>{formatBRL(c.gasto)}</Valor>}
          detalhe={c.gasto > 0 ? `${pctPequeno(c.consumido ?? 0)} do orçado · até ${formatData(hoje)}` : 'nenhum gasto lançado'}
          icone={Receipt}
        />
        <Kpi
          titulo={saldo.titulo}
          valor={<Valor><span className={saldo.cor}>{saldo.valor}</span></Valor>}
          detalhe={
            <span className="flex flex-col gap-1.5">
              <span>{saldo.detalhe}</span>
              <BarraUso c={c} />
            </span>
          }
          icone={PiggyBank}
          tom={TOM[c.faixa]}
        />
        <Kpi
          titulo="Situação do custo"
          valor={<CustoBadge faixa={c.faixa} className="text-sm" />}
          detalhe={
            c.gasto <= 0
              ? 'Lance os gastos na aba Gastos: eles vão descontando do orçado.'
              : etapasEstouradas + atividadesEstouradas > 0
                ? `${etapasEstouradas} etapa${etapasEstouradas === 1 ? '' : 's'} e ${atividadesEstouradas} atividade${atividadesEstouradas === 1 ? '' : 's'} passaram do orçado`
                : 'nenhuma etapa ou atividade passou do orçado'
          }
          icone={Gauge}
          tom={TOM[c.faixa]}
        />
        {/* Sem lógica de apontamentos no Financeiro por ora (pedido do Otavio, 10/11): sai o card "Avanço da obra". */}
        {concluida && (
          <Kpi
            titulo="Custo final"
            valor={<Valor>{formatBRL(c.gasto)}</Valor>}
            detalhe={<span className={final.cor}>{final.difTxt} ({final.pctTxt}) em relação ao orçado</span>}
            icone={Flag}
            tom={Math.abs(final.dif) < 0.5 ? 'neutro' : final.dif > 0 ? 'vermelho' : 'verde'}
          />
        )}
      </div>

      {/* ---------------- Fechamento (obra concluída) ---------------- */}
      {concluida && <Fechamento linhas={linhas} c={c} />}

      {/* ---------------- Por etapa ---------------- */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Por etapa</CardTitle>
            <CardDescription>
              Cada gasto desconta do orçado da etapa (e da atividade, se informada). Só estoura quando o gasto passa do orçado. Estouradas primeiro. Toque numa etapa para ver as
              atividades.
            </CardDescription>
          </div>
          {estimadas > 0 && (
            <Badge variant="estimativa">
              {estimadas} etapa{estimadas > 1 ? 's' : ''} com valor estimado
            </Badge>
          )}
        </CardHeader>

        {/* Desktop/tablet: tabela */}
        <CardContent className="hidden px-0 md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Etapa</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-36">Uso do orçado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const aberta = abertas.has(l.e.codigo);
                return (
                  <Fragment key={l.e.codigo}>
                    <TableRow>
                      <TableCell className="pl-3">
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-1 text-left font-medium text-gray-900 hover:text-accent"
                          onClick={() => alternar(l.e.codigo)}
                          aria-expanded={aberta}
                        >
                          {aberta ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                          {l.e.codigo}. {l.e.nome}
                        </button>
                        {l.foraFaixa && l.ref?.faixaMin != null && (
                          <Dica texto={`Peso da etapa fora da faixa de referência Caixa (${formatPct(l.ref.faixaMin, 1)} a ${formatPct(l.ref.faixaMax ?? 0, 1)})`}>
                            <span className="ml-5 inline-flex items-center gap-1 text-xs text-saude-amarelo">
                              <AlertTriangle className="size-3" /> fora da faixa Caixa
                            </span>
                          </Dica>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.e.valorEstimado && <Badge variant="estimativa">estimativa</Badge>}
                          {formatBRL(l.c.orcado)}
                        </div>
                      </TableCell>
                      <CelulasSaldo c={l.c} />
                      <TableCell>
                        <CustoBadge faixa={l.c.faixa} curto />
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => abrir(l.e)} aria-label={`Editar valor de ${l.e.nome}`}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {aberta &&
                      l.atividades.map((a) => (
                        <TableRow key={a.id} className="bg-gray-50/60 text-xs">
                          <TableCell className="pl-12 text-gray-700">
                            {a.codigo} {a.nome}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(a.c.orcado)}</TableCell>
                          <CelulasSaldo c={a.c} />
                          <TableCell>
                            <CustoBadge faixa={a.c.faixa} curto />
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    {aberta && (
                      <TableRow className="bg-gray-50/60 text-xs">
                        <TableCell className="pl-12 italic text-gray-700">
                          <Dica texto="Gastos lançados na etapa sem escolher atividade. Não têm orçado próprio: descontam do saldo da etapa.">
                            <span>Geral da etapa</span>
                          </Dica>
                        </TableCell>
                        <TableCell className="text-right text-muted">-</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(l.geral)}</TableCell>
                        <TableCell colSpan={4} className="text-muted">{l.geral > 0 ? 'desconta do saldo da etapa' : ''}</TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              <TableRow className="bg-gray-50 font-semibold hover:bg-gray-50">
                <TableCell className="pl-5">Total</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(c.orcado)}</TableCell>
                <CelulasSaldo c={c} />
                <TableCell>
                  <CustoBadge faixa={c.faixa} curto />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>

        {/* Celular: cartões */}
        <CardContent className="space-y-2 md:hidden">
          {linhas.map((l) => {
            const aberta = abertas.has(l.e.codigo);
            return (
              <div key={l.e.codigo} className={cn('rounded-lg border border-l-4 border-border p-3', bordaCusto(l.c.faixa))}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-1 text-left" onClick={() => alternar(l.e.codigo)} aria-expanded={aberta}>
                    {aberta ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">
                        {l.e.codigo}. {l.e.nome}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <CustoBadge faixa={l.c.faixa} />
                        {l.e.valorEstimado && <Badge variant="estimativa">estimativa</Badge>}
                      </span>
                    </span>
                  </button>
                  <Button variant="outline" size="icon" className="size-11 shrink-0" onClick={() => abrir(l.e)} aria-label={`Editar valor de ${l.e.nome}`}>
                    <Pencil />
                  </Button>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <Par rotulo="Orçado" valor={formatBRL(l.c.orcado)} />
                  <Par rotulo="Gasto" valor={formatBRL(l.c.gasto)} />
                  <Par rotulo={l.c.estouro > 0.005 ? 'Estourou' : 'Saldo'} valor={<span className={corSaldo(l.c)}>{formatBRL(l.c.estouro > 0.005 ? l.c.estouro : l.c.saldo)}</span>} />
                </dl>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                  <BarraUso c={l.c} className="flex-1" />
                  <span className={cn('whitespace-nowrap', corCusto(l.c.faixa))}>{formatDesvioPct(l.c)}</span>
                </div>
                {aberta && (
                  <ul className="mt-3 space-y-2 border-t border-border pt-2">
                    {l.atividades.map((a) => (
                      <li key={a.id} className="text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-gray-800">
                            {a.codigo} {a.nome}
                          </span>
                          <CustoBadge faixa={a.c.faixa} curto />
                        </div>
                        <div className="mt-0.5 text-muted">
                          Orçado {formatBRL(a.c.orcado)} · gasto {formatBRL(a.c.gasto)} ·{' '}
                          {a.c.estouro > 0.005 ? <span className="text-saude-vermelho">estourou {formatBRL(a.c.estouro)}</span> : <>saldo {formatBRL(a.c.saldo)}</>}
                        </div>
                      </li>
                    ))}
                    <li className="text-xs">
                      <span className="italic text-gray-800">Geral da etapa</span>
                      <span className="text-muted"> · gasto {formatBRL(l.geral)} (desconta do saldo da etapa)</span>
                    </li>
                  </ul>
                )}
              </div>
            );
          })}
          <div className="rounded-lg bg-gray-50 p-3 text-xs">
            <div className="mb-1 text-sm font-semibold text-gray-900">Total da obra</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <Par rotulo="Orçado" valor={formatBRL(c.orcado)} />
              <Par rotulo="Gasto" valor={formatBRL(c.gasto)} />
              <Par rotulo={c.estouro > 0.005 ? 'Estourou' : 'Saldo'} valor={<span className={corSaldo(c)}>{formatBRL(c.estouro > 0.005 ? c.estouro : c.saldo)}</span>} />
              <Par rotulo="Uso do orçado" valor={<span className={corCusto(c.faixa)}>{formatDesvioPct(c)}</span>} />
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Mês a mês + categoria ---------------- */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader>
            <CardTitle>Mês a mês</CardTitle>
            <CardDescription>
              Barras: gasto de cada mês (escala da esquerda). Linha: gasto acumulado; tracejado vermelho: orçado total da obra (escala da direita).
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-5">
            <CustoMensalChart dados={mensal} soGasto orcado={c.orcado} />
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Por categoria</CardTitle>
              <CardDescription>Só o gasto real: as categorias não têm orçado próprio.</CardDescription>
            </div>
            <Select value={etapaCat} onValueChange={setEtapaCat}>
              <SelectTrigger className="h-11 w-full sm:h-9" aria-label="Etapa da quebra por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Obra toda</SelectItem>
                {obra.etapas.map((e) => (
                  <SelectItem key={e.codigo} value={String(e.codigo)}>
                    {e.codigo}. {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <CategoriaBarras itens={categorias} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={editando != null} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar valor da etapa</DialogTitle>
            <DialogDescription>
              {editando?.codigo}. {editando?.nome}. O novo valor é distribuído entre as atividades na mesma proporção atual, deixa de ser estimativa e o orçamento total é
              recalculado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="valor-etapa">Valor orçado (R$)</Label>
            <Input id="valor-etapa" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} />
            {valorValido ? (
              <div className="text-xs text-muted">{formatBRL(valorNovo)}</div>
            ) : (
              <div className="text-xs text-saude-vermelho">Informe um valor válido, por exemplo 125000,00.</div>
            )}
          </div>
          {temBaseline && (
            <div className="rounded-md bg-saude-amarelo/5 px-3 py-2 text-xs text-saude-amarelo">
              A baseline inicial guarda os valores do congelamento e é fixa: o planejado continua medido por ela.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!valorValido}>
              Salvar valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bloco "Fechamento": orçado x realizado final, total e por etapa. */
function Fechamento({ linhas, c }: { linhas: LinhaEtapa[]; c: IndicadoresCusto }) {
  const total = diferencaFinal(c.orcado, c.gasto);
  const porEtapa = [...linhas].sort((a, b) => a.e.codigo - b.e.codigo);
  return (
    <Card className="border-l-4 border-l-saude-azul">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="size-4 text-saude-azul" /> Fechamento da obra
        </CardTitle>
        <CardDescription>Obra concluída: o orçado comparado com tudo o que foi gasto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Par rotulo="Orçado" valor={formatBRL(c.orcado)} grande />
          <Par rotulo="Realizado (gasto)" valor={formatBRL(c.gasto)} grande />
          <Par rotulo="Diferença" valor={<span className={total.cor}>{total.difTxt}</span>} grande />
          <Par rotulo="Diferença %" valor={<span className={total.cor}>{total.pctTxt}</span>} grande />
        </dl>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porEtapa.map((l) => {
                const d = diferencaFinal(l.c.orcado, l.c.gasto);
                return (
                  <TableRow key={l.e.codigo}>
                    <TableCell className="min-w-40">
                      {l.e.codigo}. {l.e.nome}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(l.c.orcado)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(l.c.gasto)}</TableCell>
                    <TableCell className={cn('whitespace-nowrap text-right tabular-nums', d.cor)}>{d.difTxt}</TableCell>
                    <TableCell className={cn('whitespace-nowrap text-right tabular-nums', d.cor)}>{d.pctTxt}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Gasto · Saldo (ou "Estourou R$ X") · barra de uso do orçado · % feito. */
function CelulasSaldo({ c }: { c: IndicadoresCusto }) {
  const estourou = c.estouro > 0.005;
  return (
    <>
      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(c.gasto)}</TableCell>
      <TableCell className={cn('whitespace-nowrap text-right tabular-nums', corSaldo(c))}>
        {estourou ? (
          <>
            <div>-{formatBRL(c.estouro)}</div>
            <div className="text-[11px]">estourou</div>
          </>
        ) : (
          formatBRL(c.saldo)
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <BarraUso c={c} className="w-16" />
          <span className={cn('whitespace-nowrap text-[11px] tabular-nums', c.gasto > 0 ? corCusto(c.faixa) : 'text-muted')}>{c.gasto > 0 ? formatDesvioPct(c) : '-'}</span>
        </div>
      </TableCell>
    </>
  );
}

function corSaldo(c: IndicadoresCusto): string {
  if (c.estouro > 0.005) return 'text-saude-vermelho';
  if (c.faixa === 'atencao') return 'text-saude-amarelo';
  return 'text-gray-900';
}

function Par({ rotulo, valor, grande }: { rotulo: string; valor: ReactNode; grande?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{rotulo}</dt>
      <dd className={cn('truncate font-semibold tabular-nums text-gray-900', grande ? 'text-lg' : 'text-xs')}>{valor}</dd>
    </div>
  );
}

/** Número dos cards: menor que o padrão do Kpi para R$ com milhões caber em 2 colunas (390 px) e em 5 colunas (1440 px). */
function Valor({ children }: { children: ReactNode }) {
  return <span className="block break-words text-lg leading-tight sm:text-xl">{children}</span>;
}

function bordaCusto(f: FaixaCusto): string {
  return { dentro: 'border-l-saude-verde', atencao: 'border-l-saude-amarelo', acima: 'border-l-saude-vermelho', sem_gastos: 'border-l-gray-200' }[f];
}
