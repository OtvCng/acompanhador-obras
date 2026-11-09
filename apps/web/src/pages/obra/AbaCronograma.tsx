import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, History, Lock, Pencil, Save, X } from 'lucide-react';
import { baselineVigente, faixaPorSpi, indicadoresEtapa, planejadoItem, type Atividade, type FaixaSaude, type ISODate, type ItemAtividade, type Obra } from '@obras/shared';
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
  SAUDE,
  SaudePonto,
  Textarea,
} from '@/components/ui';
import { diasEntre, formatData, formatDiaMes, formatMesAno, formatPctFracao, formatSPI } from '@/lib/format';
import { useNomeUsuario } from './comum';
import { cn } from '@/lib/utils';

type Datas = { inicio: ISODate; fim: ISODate };
type Rascunho = Record<string, Datas>;

interface Agregado {
  realizado: number; // 0..1
  planejado: number; // 0..1
  spi: number | null;
  faixa: FaixaSaude;
  base: Datas | null;
  atual: Datas;
}

const minD = (a: ISODate, b: ISODate) => (a < b ? a : b);
const maxD = (a: ISODate, b: ISODate) => (a > b ? a : b);

function spanDe(lista: Datas[]): Datas | null {
  if (!lista.length) return null;
  return lista.reduce((acc, d) => ({ inicio: minD(acc.inicio, d.inicio), fim: maxD(acc.fim, d.fim) }));
}

export function AbaCronograma({ obra }: { obra: Obra }) {
  const { hoje, usuarioAtual, atualizarObra, congelarBaseline } = useObras();
  const nomeUsuario = useNomeUsuario();
  const podeEditar = usuarioAtual.perfil === 'diretor' || usuarioAtual.perfil === 'engenheiro';
  const base = baselineVigente(obra);

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<null | 'replanejar' | 'congelar'>(null);
  const [justificativa, setJustificativa] = useState('');

  const locais = useMemo(() => new Map(obra.locais.map((l) => [l.id, l])), [obra.locais]);

  // Ao montar (e ao trocar a data de referência), rola o Gantt para a linha "hoje" ficar visível.
  const rolagemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const caixa = rolagemRef.current;
    const marca = caixa?.querySelector<HTMLElement>('[data-hoje]');
    if (!caixa || !marca || caixa.scrollWidth <= caixa.clientWidth) return;
    const x = marca.getBoundingClientRect().left - caixa.getBoundingClientRect().left + caixa.scrollLeft;
    caixa.scrollLeft = Math.max(0, x - caixa.clientWidth * 0.7);
  }, [hoje, obra.id]);

  const datasAtuais = (it: ItemAtividade): Datas => rascunho[it.id] ?? { inicio: it.inicioPlanejado, fim: it.fimPlanejado };
  const datasBase = (it: ItemAtividade): Datas | null => {
    const b = base?.itens[it.id];
    return b ? { inicio: b.inicio, fim: b.fim } : null;
  };

  /** Faixa total do Gantt. */
  const escala = useMemo(() => {
    let ini = obra.dataInicio;
    let fim = obra.dataInicio;
    for (const e of obra.etapas)
      for (const a of e.atividades)
        for (const it of a.itens) {
          const d = rascunho[it.id] ?? { inicio: it.inicioPlanejado, fim: it.fimPlanejado };
          ini = minD(ini, d.inicio);
          fim = maxD(fim, d.fim);
          const b = base?.itens[it.id];
          if (b) {
            ini = minD(ini, b.inicio);
            fim = maxD(fim, b.fim);
          }
        }
    const total = Math.max(1, diasEntre(ini, fim) + 1);
    const meses: { rotulo: string; pos: number }[] = [];
    const [a0, m0] = ini.split('-').map(Number);
    let ano = a0!;
    let mes = m0!;
    for (let k = 0; k < 120; k++) {
      const d = `${ano}-${String(mes).padStart(2, '0')}-01`;
      if (d > fim) break;
      if (d >= ini) meses.push({ rotulo: formatMesAno(d), pos: (diasEntre(ini, d) / total) * 100 });
      mes++;
      if (mes > 12) {
        mes = 1;
        ano++;
      }
    }
    return { ini, fim, total, meses };
  }, [obra, base, rascunho]);

  const pos = (d: ISODate) => (diasEntre(escala.ini, d) / escala.total) * 100;
  const larg = (d: Datas) => ((diasEntre(d.inicio, d.fim) + 1) / escala.total) * 100;
  const posHoje = hoje >= escala.ini && hoje <= escala.fim ? pos(hoje) : null;

  function agregarItens(itens: ItemAtividade[]): Agregado {
    const tot = itens.reduce((s, i) => s + i.valorOrcado, 0) || itens.length || 1;
    const peso = (i: ItemAtividade) => (itens.reduce((s, x) => s + x.valorOrcado, 0) ? i.valorOrcado : 1);
    const realizado = itens.reduce((s, i) => s + (i.percentual / 100) * peso(i), 0) / tot;
    const planejado = itens.reduce((s, i) => s + planejadoItem(obra, i.id, hoje) * peso(i), 0) / tot;
    const spi = planejado > 0 ? realizado / planejado : null;
    const concluida = itens.length > 0 && itens.every((i) => i.percentual >= 100);
    return {
      realizado,
      planejado,
      spi,
      faixa: faixaPorSpi(spi, realizado, concluida),
      base: spanDe(itens.map(datasBase).filter((d): d is Datas => d != null)),
      atual: spanDe(itens.map(datasAtuais)) ?? { inicio: obra.dataInicio, fim: obra.dataInicio },
    };
  }

  function mudarData(it: ItemAtividade, campo: 'inicio' | 'fim', valor: string) {
    if (!valor) return;
    setRascunho((r) => {
      const atual = r[it.id] ?? { inicio: it.inicioPlanejado, fim: it.fimPlanejado };
      return { ...r, [it.id]: { ...atual, [campo]: valor } };
    });
  }

  const alterados = Object.entries(rascunho).filter(([id, d]) => {
    for (const e of obra.etapas)
      for (const a of e.atividades) {
        const it = a.itens.find((x) => x.id === id);
        if (it) return it.inicioPlanejado !== d.inicio || it.fimPlanejado !== d.fim;
      }
    return false;
  });
  const invalidos = Object.values(rascunho).filter((d) => d.fim < d.inicio).length;

  function obraComRascunho(): Obra {
    return {
      ...obra,
      etapas: obra.etapas.map((e) => ({
        ...e,
        atividades: e.atividades.map((a) => ({
          ...a,
          itens: a.itens.map((it) => (rascunho[it.id] ? { ...it, inicioPlanejado: rascunho[it.id]!.inicio, fimPlanejado: rascunho[it.id]!.fim } : it)),
        })),
      })),
    };
  }

  function cancelar() {
    setRascunho({});
    setEditando(false);
  }

  function salvar() {
    try {
      atualizarObra(obraComRascunho());
      toast.success(base ? 'Datas atuais salvas. O atraso continua medido contra a baseline vigente.' : 'Datas salvas.');
      cancelar();
    } catch (e) {
      toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  function confirmarBaseline() {
    try {
      if (alterados.length) atualizarObra(obraComRascunho());
      if (dialogo === 'replanejar') congelarBaseline(obra.id, justificativa.trim());
      else congelarBaseline(obra.id);
      toast.success(dialogo === 'replanejar' ? `Replanejamento salvo como baseline v${(base?.versao ?? 0) + 1}.` : 'Baseline v1 congelada.');
      setDialogo(null);
      setJustificativa('');
      cancelar();
    } catch (e) {
      toast.error(`Não foi possível congelar a baseline: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  const alternar = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  // Funções de renderização (não componentes), para não remontar os inputs de data a cada tecla.
  function barraGantt(b: Datas | null, a: Datas, faixa: FaixaSaude, fina?: boolean) {
    return (
      <div className="relative h-7 w-full">
        {escala.meses.map((m) => (
          <div key={m.rotulo} className="absolute inset-y-0 w-px bg-gray-100" style={{ left: `${m.pos}%` }} />
        ))}
        {b && (
          <div
            className="absolute top-1 h-1.5 rounded-full bg-gray-300"
            style={{ left: `${pos(b.inicio)}%`, width: `${larg(b)}%` }}
            title={`Baseline: ${formatData(b.inicio)} a ${formatData(b.fim)}`}
          />
        )}
        <div
          className={cn('absolute rounded-sm opacity-90', SAUDE[faixa].bg, fina ? 'top-3.5 h-2' : 'top-3.5 h-2.5')}
          style={{ left: `${pos(a.inicio)}%`, width: `max(${larg(a)}%, 3px)` }}
          title={`Atual: ${formatData(a.inicio)} a ${formatData(a.fim)}`}
        />
        {posHoje != null && <div className="absolute inset-y-0 w-px bg-gray-900/70" style={{ left: `${posHoje}%` }} />}
      </div>
    );
  }

  function celulasNumeros(g: Agregado) {
    return (
      <>
        <td className="px-2 text-right tabular-nums text-gray-900">{formatPctFracao(g.realizado, 0)}</td>
        <td className="px-2 text-right tabular-nums text-muted">{formatPctFracao(g.planejado, 0)}</td>
        <td className="px-2 text-right tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            {formatSPI(g.spi)}
            <SaudePonto faixa={g.faixa} />
          </span>
        </td>
      </>
    );
  }

  function celulasDatas(g: Agregado, item?: ItemAtividade) {
    const d = item ? datasAtuais(item) : g.atual;
    const mudou = g.base && (g.base.inicio !== d.inicio || g.base.fim !== d.fim);
    return (
      <>
        <td className="whitespace-nowrap px-2 text-xs text-muted">{g.base ? `${formatDiaMes(g.base.inicio)} a ${formatDiaMes(g.base.fim)}` : 'sem baseline'}</td>
        <td className={cn('whitespace-nowrap px-2 text-xs', mudou ? 'font-medium text-saude-amarelo' : 'text-gray-700')}>
          {item && editando ? (
            <div className="flex items-center gap-1">
              <Input type="date" value={d.inicio} onChange={(e) => mudarData(item, 'inicio', e.target.value)} className="h-7 w-32 px-1.5 text-xs" aria-label="Início atual" />
              <Input
                type="date"
                value={d.fim}
                onChange={(e) => mudarData(item, 'fim', e.target.value)}
                className={cn('h-7 w-32 px-1.5 text-xs', d.fim < d.inicio && 'border-saude-vermelho')}
                aria-label="Fim atual"
              />
            </div>
          ) : (
            `${formatDiaMes(d.inicio)} a ${formatDiaMes(d.fim)}`
          )}
        </td>
      </>
    );
  }

  function linhaAtividade(a: Atividade) {
    const g = agregarItens(a.itens);
    const unico = a.itens.length === 1 ? a.itens[0] : undefined;
    const aberta = abertas.has(a.id);
    return (
      <>
        <tr className="border-b border-border hover:bg-gray-50/60">
          <td className="max-w-[300px] py-1 pl-8 pr-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {!unico ? (
                <button className="cursor-pointer rounded p-0.5 text-muted hover:bg-gray-100" onClick={() => setAbertas((s) => alternar(s, a.id))} aria-label={aberta ? 'Recolher' : 'Expandir'}>
                  {aberta ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </button>
              ) : (
                <span className="w-4.5" />
              )}
              <span className="shrink-0 text-xs text-muted">{a.codigo}</span>
              <span className="min-w-0 truncate text-sm text-gray-900" title={`${a.codigo} ${a.nome}${unico && locais.get(unico.localId)?.tipo !== 'obra' ? ` · ${locais.get(unico.localId)?.nome}` : ''}`}>{a.nome}</span>
              {!unico && (
                <span className="shrink-0 text-xs text-muted" title={`${a.itens.length} locais`}>
                  ({a.itens.length})
                </span>
              )}
              {unico && locais.get(unico.localId)?.tipo !== 'obra' && <span className="shrink-0 text-xs text-muted">· {locais.get(unico.localId)?.nome}</span>}
              {!a.duracaoConfirmada && (
                <Dica texto="Duração estimada pelo modelo, ainda não validada">
                  <Badge variant="estimativa" className="shrink-0 px-1.5 py-0 text-[10px]">NÃO CONFIRMADO</Badge>
                </Dica>
              )}
            </div>
          </td>
          {celulasDatas(unico ? { ...g, base: datasBase(unico) } : g, unico)}
          {celulasNumeros(g)}
          <td className="min-w-[420px] px-2">
            {barraGantt(g.base, unico ? datasAtuais(unico) : g.atual, g.faixa)}
          </td>
        </tr>
        {!unico &&
          aberta &&
          [...a.itens]
            .sort((x, y) => (locais.get(x.localId)?.ordem ?? 0) - (locais.get(y.localId)?.ordem ?? 0))
            .map((it) => {
              const gi = agregarItens([it]);
              return (
                <tr key={it.id} className="border-b border-border bg-gray-50/40 hover:bg-gray-50">
                  <td className="py-1 pl-16 pr-2 text-xs text-gray-700">{locais.get(it.localId)?.nome ?? 'Local'}</td>
                  {celulasDatas(gi, it)}
                  {celulasNumeros(gi)}
                  <td className="px-2">
                    {barraGantt(gi.base, datasAtuais(it), gi.faixa, true)}
                  </td>
                </tr>
              );
            })}
      </>
    );
  }

  const semItens = obra.etapas.every((e) => e.atividades.every((a) => a.itens.length === 0));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Cronograma</CardTitle>
            <CardDescription>
              Etapa, atividade e local. Barra cinza = baseline{base ? ` v${base.versao}` : ''}; barra colorida = datas atuais (cor pela saúde); linha preta = hoje.
            </CardDescription>
          </div>
          {podeEditar && (
            <div className="flex flex-wrap gap-2">
              {!editando ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                    <Pencil /> Editar datas
                  </Button>
                  {!base && (
                    <Button size="sm" onClick={() => setDialogo('congelar')} disabled={semItens}>
                      <Lock /> Congelar baseline v1
                    </Button>
                  )}
                  {base && (
                    <Button size="sm" onClick={() => setDialogo('replanejar')}>
                      <History /> Replanejar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <span className="self-center text-xs text-muted">
                    {alterados.length} item{alterados.length === 1 ? '' : 's'} alterado{alterados.length === 1 ? '' : 's'}
                    {invalidos > 0 && <span className="text-saude-vermelho"> · {invalidos} com fim antes do início</span>}
                  </span>
                  <Button variant="ghost" size="sm" onClick={cancelar}>
                    <X /> Cancelar
                  </Button>
                  <Button variant="outline" size="sm" onClick={salvar} disabled={!alterados.length || invalidos > 0}>
                    <Save /> Salvar datas atuais
                  </Button>
                  {base ? (
                    <Button size="sm" onClick={() => setDialogo('replanejar')} disabled={invalidos > 0}>
                      <History /> Replanejar (nova baseline)
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setDialogo('congelar')} disabled={invalidos > 0}>
                      <Lock /> Salvar e congelar v1
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {semItens ? (
            <div className="px-5 py-8 text-center text-sm text-muted">Esta obra ainda não tem atividades no cronograma.</div>
          ) : (
            <div className="overflow-x-auto" ref={rolagemRef}>
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                    <th className="w-[300px] px-5 py-2">Etapa / atividade / local</th>
                    <th className="px-2 py-2">Baseline</th>
                    <th className="px-2 py-2">Atual</th>
                    <th className="px-2 py-2 text-right">Real.</th>
                    <th className="px-2 py-2 text-right">Plan.</th>
                    <th className="px-2 py-2 text-right">SPI</th>
                    <th className="px-2 py-2">
                      <div className="relative h-4">
                        {escala.meses.map((m) => (
                          <span key={m.rotulo} className="absolute -translate-x-0 text-[10px] font-medium" style={{ left: `${m.pos}%` }}>
                            {m.rotulo}
                          </span>
                        ))}
                        {posHoje != null && (
                          <span data-hoje className="absolute -top-0.5 -translate-x-1/2 rounded bg-gray-900 px-1 text-[10px] text-white" style={{ left: `${posHoje}%` }}>
                            hoje
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obra.etapas.map((e) => {
                    if (!e.atividades.length) return null;
                    const ie = indicadoresEtapa(obra, e, hoje);
                    const itens = e.atividades.flatMap((a) => a.itens);
                    const g = { ...agregarItens(itens), realizado: ie.realizado, planejado: ie.planejado, spi: ie.spi, faixa: ie.faixa };
                    const aberta = !fechadas.has(e.codigo);
                    return (
                      <Fragment key={e.codigo}>
                        <tr className="border-b border-border bg-gray-50">
                          <td className="max-w-[300px] py-1.5 pl-3 pr-2">
                            <button
                              className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left font-semibold text-gray-900"
                              onClick={() => setFechadas((s) => alternar(s, e.codigo))}
                              title={`${e.codigo}. ${e.nome}`}
                            >
                              {aberta ? <ChevronDown className="size-4 shrink-0 text-muted" /> : <ChevronRight className="size-4 shrink-0 text-muted" />}
                              <span className="min-w-0 truncate">
                                {e.codigo}. {e.nome}
                              </span>
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-2 text-xs text-muted">{g.base ? `${formatDiaMes(g.base.inicio)} a ${formatDiaMes(g.base.fim)}` : 'sem baseline'}</td>
                          <td className="whitespace-nowrap px-2 text-xs text-gray-700">{`${formatDiaMes(g.atual.inicio)} a ${formatDiaMes(g.atual.fim)}`}</td>
                          {celulasNumeros(g)}
                          <td className="px-2">{barraGantt(g.base, g.atual, g.faixa)}</td>
                        </tr>
                        {aberta && e.atividades.map((a) => <Fragment key={a.id}>{linhaAtividade(a)}</Fragment>)}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" /> Versões da baseline
          </CardTitle>
          <CardDescription>O atraso é sempre medido contra a versão vigente (a mais recente).</CardDescription>
        </CardHeader>
        <CardContent>
          {obra.baselines.length === 0 ? (
            <div className="text-sm text-muted">Nenhuma baseline congelada. A obra está em planejamento.</div>
          ) : (
            <ol className="space-y-2">
              {[...obra.baselines].reverse().map((b) => {
                const fimV = Object.values(b.itens).reduce((m, x) => maxD(m, x.fim), obra.dataInicio);
                const vigente = b.versao === base?.versao;
                return (
                  <li key={b.versao} className={cn('flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5', vigente ? 'border-accent/40 bg-accent/5' : 'border-border')}>
                    <Badge variant={vigente ? 'default' : 'secondary'}>v{b.versao}</Badge>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="text-gray-900">
                        Congelada em {formatData(b.congeladaEm)} por {nomeUsuario(b.autorId)}
                        {vigente && <span className="ml-2 text-xs font-medium text-accent">vigente</span>}
                      </div>
                      <div className="text-xs text-muted">{b.justificativa ? `Justificativa: ${b.justificativa}` : 'Versão inicial (sem justificativa).'}</div>
                    </div>
                    <div className="text-xs text-muted">fim previsto {formatData(fimV)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogo != null} onOpenChange={(o) => !o && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogo === 'replanejar' ? `Replanejar: gerar baseline v${(base?.versao ?? 0) + 1}` : 'Congelar baseline v1'}</DialogTitle>
            <DialogDescription>
              {dialogo === 'replanejar'
                ? 'As datas atuais (com as alterações em edição) passam a ser a nova referência de prazo. As versões anteriores ficam no histórico.'
                : 'As datas e valores atuais viram a referência oficial de prazo. Depois disso, mudanças de prazo exigem replanejamento com justificativa.'}
            </DialogDescription>
          </DialogHeader>
          {alterados.length > 0 && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {alterados.length} item{alterados.length === 1 ? '' : 's'} com datas alteradas será{alterados.length === 1 ? '' : 'ão'} salvo{alterados.length === 1 ? '' : 's'} junto.
            </div>
          )}
          {dialogo === 'replanejar' && (
            <div className="space-y-1.5">
              <Label htmlFor="just">Justificativa (obrigatória)</Label>
              <Textarea
                id="just"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: chuvas acima da média em outubro atrasaram a estrutura do 2º pavimento."
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarBaseline} disabled={dialogo === 'replanejar' && justificativa.trim().length < 5}>
              {dialogo === 'replanejar' ? 'Gerar nova versão' : 'Congelar v1'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
