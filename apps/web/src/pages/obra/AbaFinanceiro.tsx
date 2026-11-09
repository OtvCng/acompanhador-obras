import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Pencil } from 'lucide-react';
import { ETAPAS_CAIXA, curvaS, etapasForaDaFaixa, indicadoresEtapa, indicadoresObra, type EtapaObra, type Obra } from '@obras/shared';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { MensalChart, curvaParaMensal } from '@/components/charts';
import { formatBRL, formatData, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Troca o valor de uma etapa: redistribui proporcionalmente nos itens, marca valorEstimado = false e recalcula o orçamento total. */
function comNovoValor(obra: Obra, codigo: number, valor: number): Obra {
  const etapas = obra.etapas.map((e) => {
    if (e.codigo !== codigo) return e;
    const itens = e.atividades.flatMap((a) => a.itens);
    const somaItens = itens.reduce((s, i) => s + i.valorOrcado, 0);
    const fator = somaItens > 0 ? valor / somaItens : 0;
    const porItemIgual = itens.length ? valor / itens.length : 0;
    return {
      ...e,
      valorOrcado: valor,
      valorEstimado: false,
      atividades: e.atividades.map((a) => ({
        ...a,
        itens: a.itens.map((i) => ({ ...i, valorOrcado: Math.round((somaItens > 0 ? i.valorOrcado * fator : porItemIgual) * 100) / 100 })),
      })),
    };
  });
  return { ...obra, etapas, orcamentoTotal: Math.round(etapas.reduce((s, e) => s + e.valorOrcado, 0) * 100) / 100 };
}

export function AbaFinanceiro({ obra }: { obra: Obra }) {
  const { hoje, atualizarObra } = useObras();
  const [editando, setEditando] = useState<EtapaObra | null>(null);
  const [valorTxt, setValorTxt] = useState('');

  const ind = useMemo(() => indicadoresObra(obra, hoje), [obra, hoje]);
  const fora = useMemo(() => new Set(etapasForaDaFaixa(obra).map((f) => f.codigo)), [obra]);
  const linhas = useMemo(
    () =>
      obra.etapas.map((e) => ({
        e,
        i: indicadoresEtapa(obra, e, hoje),
        ref: ETAPAS_CAIXA.find((r) => r.codigo === e.codigo),
        pct: obra.orcamentoTotal > 0 ? (e.valorOrcado / obra.orcamentoTotal) * 100 : 0,
      })),
    [obra, hoje],
  );
  const mensal = useMemo(() => curvaParaMensal(curvaS(obra, hoje)), [obra, hoje]);
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
      atualizarObra(comNovoValor(obra, editando.codigo, valorNovo));
      toast.success(`Valor de "${editando.nome}" atualizado.`);
      setEditando(null);
    } catch (err) {
      toast.error(`Não foi possível salvar: ${err instanceof Error ? err.message : 'erro'}`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Orçamento por etapa</CardTitle>
            <CardDescription>
              Valor agregado = orçado × % realizado. Valor planejado = orçado × % planejado pela baseline até {formatData(hoje)}.
            </CardDescription>
          </div>
          {estimadas > 0 && (
            <Badge variant="estimativa">
              {estimadas} etapa{estimadas > 1 ? 's' : ''} com valor estimado
            </Badge>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Etapa</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">% do total</TableHead>
                <TableHead>Faixa Caixa</TableHead>
                <TableHead className="text-right">Valor agregado</TableHead>
                <TableHead className="text-right">Valor planejado</TableHead>
                <TableHead className="text-right">Desvio</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ e, i, ref, pct }) => {
                const desvio = i.valorAgregado - i.valorPlanejado;
                const foraFaixa = fora.has(e.codigo);
                return (
                  <TableRow key={e.codigo}>
                    <TableCell className="pl-5">
                      <div className="font-medium text-gray-900">
                        {e.codigo}. {e.nome}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.valorEstimado && <Badge variant="estimativa">estimativa</Badge>}
                        {formatBRL(e.valorOrcado)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(pct)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ref && ref.faixaMin != null && ref.faixaMax != null ? (
                        <span className={cn('inline-flex items-center gap-1', foraFaixa ? 'font-medium text-saude-amarelo' : 'text-gray-700')}>
                          {formatPct(ref.faixaMin, 0)} a {formatPct(ref.faixaMax, 0)}
                          {foraFaixa && (
                            <Dica texto="Percentual fora da faixa de referência Caixa">
                              <AlertTriangle className="size-3.5" />
                            </Dica>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted">sem referência</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(i.valorAgregado)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted">{formatBRL(i.valorPlanejado)}</TableCell>
                    <TableCell className={cn('whitespace-nowrap text-right tabular-nums', desvio < -0.005 ? 'text-saude-vermelho' : 'text-gray-700')}>
                      <span className="inline-flex items-center gap-1">
                        {formatBRL(desvio)}
                        {i.alertaCaixa && (
                          <Dica texto="Desvio físico maior que 10 pp (critério Caixa)">
                            <AlertTriangle className="size-3.5 text-saude-amarelo" />
                          </Dica>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => abrir(e)} aria-label={`Editar valor de ${e.nome}`}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-gray-50 font-semibold hover:bg-gray-50">
                <TableCell className="pl-5">Total</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(obra.orcamentoTotal)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell />
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(ind.valorAgregado)}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatBRL(ind.valorPlanejado)}</TableCell>
                <TableCell className={cn('whitespace-nowrap text-right tabular-nums', ind.valorAgregado - ind.valorPlanejado < -0.005 && 'text-saude-vermelho')}>
                  {formatBRL(ind.valorAgregado - ind.valorPlanejado)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previsto x realizado por mês</CardTitle>
          <CardDescription>Valor previsto pela baseline e valor agregado em cada mês (não acumulado). Gastos reais entram na fase 2.</CardDescription>
        </CardHeader>
        <CardContent>
          <MensalChart dados={mensal} />
        </CardContent>
      </Card>

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
              A baseline vigente guarda os valores do congelamento. O planejado continua medido por ela até um replanejamento.
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
