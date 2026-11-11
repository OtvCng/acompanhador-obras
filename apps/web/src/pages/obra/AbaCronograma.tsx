/**
 * Cronograma editável direto na tabela (plano 2026-11-11-15-05).
 * - Datas, duração e predecessoras: diretor/engenheiro. % realizado: qualquer perfil que vê a obra.
 * - Tudo vai para um rascunho; um só botão "Salvar" (canto superior direito) grava datas, predecessoras e avanços.
 * - Mudança de prazo de etapa/atividade a mais de 5 d.u. da baseline inicial pede justificativa (a API também confere).
 * - Sem baseline: o primeiro save congela a baseline inicial (v1), que é fixa.
 * - Predecessoras por etapa (término→início) empurram as sucessoras no rascunho (plano 2026-11-11-14-10).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, History, Link2, Save, X } from 'lucide-react';
import {
  LIMITE_JUSTIFICATIVA_DU,
  addDiasUteis,
  baselineVigente,
  contarDiasUteis,
  desviosParaJustificar,
  faixaPorSpi,
  indicadoresEtapa,
  planejadoItem,
  reprogramarPorPredecessoras,
  sucessorasTransitivas,
  type Atividade,
  type DesvioCronograma,
  type EtapaObra,
  type FaixaSaude,
  type ISODate,
  type ItemAtividade,
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
  SAUDE,
  SaudePonto,
  Textarea,
} from '@/components/ui';
import { diasEntre, formatData, formatDiaMes, formatMesAno, formatPctFracao, formatSPI } from '@/lib/format';
import { useNomeUsuario } from './comum';
import { GradePorAndar } from './GradePorAndar';
import { cn } from '@/lib/utils';

type Datas = { inicio: ISODate; fim: ISODate };

interface Agregado {
  realizado: number; // 0..1
  planejado: number; // 0..1
  spi: number | null;
  faixa: FaixaSaude;
  base: Datas | null;
  atual: Datas;
  /** Dias úteis em que algum item está em execução (dia com 2 locais conta 1 vez). Menor que o prazo quando há intervalo entre locais. */
  execucao: number;
}

/** União dos dias úteis cobertos pelos intervalos (sem contar o mesmo dia duas vezes). */
function diasDeExecucao(lista: Datas[]): number {
  const dias = new Set<string>();
  for (const d of lista) {
    if (d.fim < d.inicio) continue;
    for (let k = 0, dia = addDiasUteis(d.inicio, 0); dia <= d.fim && k < 3000; k++, dia = addDiasUteis(d.inicio, k)) dias.add(dia);
  }
  return dias.size;
}

const minD = (a: ISODate, b: ISODate) => (a < b ? a : b);
const maxD = (a: ISODate, b: ISODate) => (a > b ? a : b);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));

function spanDe(lista: Datas[]): Datas | null {
  if (!lista.length) return null;
  return lista.reduce((acc, d) => ({ inicio: minD(acc.inicio, d.inicio), fim: maxD(acc.fim, d.fim) }));
}

export function AbaCronograma({ obra }: { obra: Obra }) {
  const { hoje, usuarioAtual, atualizarObra, congelarBaseline, lancarApontamento } = useObras();
  const nomeUsuario = useNomeUsuario();
  const podeEditarDatas = usuarioAtual.perfil === 'diretor' || usuarioAtual.perfil === 'engenheiro';
  const base = baselineVigente(obra); // sempre a inicial (v1)

  const [rascunho, setRascunho] = useState<Record<string, Datas>>({});
  const [rascunhoPred, setRascunhoPred] = useState<Record<number, number[]>>({});
  const [rascunhoPct, setRascunhoPct] = useState<Record<string, number>>({});
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());
  // Atividades com vários locais: guarda as FECHADAS (padrão = abertas, para os campos de cada local ficarem à vista).
  const [locaisFechados, setLocaisFechados] = useState<Set<string>>(new Set());
  // Visões (plano 2026-11-11-16-20): "andar" = grade de lançamento; "etapa" = Gantt de prazos (com filtro de andar).
  const temAndares = obra.locais.some((l) => l.tipo !== 'obra' && obra.etapas.some((e) => e.atividades.some((a) => a.itens.some((i) => i.localId === l.id))));
  const [visao, setVisao] = useState<'andar' | 'etapa'>(temAndares ? 'andar' : 'etapa');
  const [filtroLocal, setFiltroLocal] = useState<string>('todos');
  const [predAberta, setPredAberta] = useState<number | null>(null);
  const [desviosPendentes, setDesviosPendentes] = useState<DesvioCronograma[] | null>(null);
  const [justificativa, setJustificativa] = useState('');

  const locais = useMemo(() => new Map(obra.locais.map((l) => [l.id, l])), [obra.locais]);
  const todosItens = useMemo(() => obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)), [obra.etapas]);

  // ---------------------------------------------------------------- avanço (%)
  const pctDe = (it: ItemAtividade) => rascunhoPct[it.id] ?? it.percentual;
  const avancosAlterados = todosItens.filter((it) => rascunhoPct[it.id] != null && rascunhoPct[it.id] !== it.percentual);
  function definirPct(itens: ItemAtividade[], valor: number) {
    setRascunhoPct((r) => ({ ...r, ...Object.fromEntries(itens.map((i) => [i.id, valor])) }));
  }
  function mudarPct(it: ItemAtividade, valor: string) {
    const n = valor === '' ? 0 : Math.round(Number(valor));
    if (!Number.isFinite(n)) return;
    setRascunhoPct((r) => ({ ...r, [it.id]: Math.max(0, Math.min(100, n)) }));
  }

  // ---------------------------------------------------------------- predecessoras + datas
  const predDe = (e: EtapaObra): number[] => rascunhoPred[e.codigo] ?? e.predecessoras ?? [];
  const etapasComPred = useMemo(
    () => obra.etapas.map((e) => ({ ...e, predecessoras: rascunhoPred[e.codigo] ?? e.predecessoras ?? [] })),
    [obra.etapas, rascunhoPred],
  );
  const reprog = useMemo(() => reprogramarPorPredecessoras({ ...obra, etapas: etapasComPred }, rascunho), [obra, etapasComPred, rascunho]);
  const empurradaPor = new Map(reprog.empurradas.map((x) => [x.codigo, x.dias]));
  const violacaoPor = new Map(reprog.violacoes.map((x) => [x.codigo, x.inicioMinimo]));
  const predAlteradas = obra.etapas.filter((e) => {
    const r = rascunhoPred[e.codigo];
    return r != null && [...r].sort().join(',') !== [...(e.predecessoras ?? [])].sort().join(',');
  }).length;

  /** Datas efetivas: rascunho + empurrões das predecessoras. */
  const datasAtuais = (it: ItemAtividade): Datas => reprog.datas[it.id] ?? rascunho[it.id] ?? { inicio: it.inicioPlanejado, fim: it.fimPlanejado };
  const datasBase = (it: ItemAtividade): Datas | null => {
    const b = base?.itens[it.id];
    return b ? { inicio: b.inicio, fim: b.fim } : null;
  };

  function mudarData(it: ItemAtividade, campo: 'inicio' | 'fim', valor: string) {
    if (!valor) return;
    const atual = datasAtuais(it); // parte da data efetiva (já empurrada), para o campo não "voltar"
    setRascunho((r) => ({ ...r, [it.id]: { ...atual, [campo]: valor } }));
  }
  /** Duração digitada (dias úteis) → fim = início + (n − 1) dias úteis. O início não muda. */
  function mudarDuracao(it: ItemAtividade, valor: string) {
    const n = Math.round(Number(valor));
    if (!valor || !Number.isFinite(n) || n < 1) return;
    const atual = datasAtuais(it);
    setRascunho((r) => ({ ...r, [it.id]: { ...atual, fim: addDiasUteis(atual.inicio, Math.min(n, 2000) - 1) } }));
  }
  function alternarPred(codigo: number, p: number) {
    const e = obra.etapas.find((x) => x.codigo === codigo);
    if (!e) return;
    const atuais = predDe(e);
    const novas = atuais.includes(p) ? atuais.filter((x) => x !== p) : [...atuais, p].sort((a, b) => a - b);
    setRascunhoPred((r) => ({ ...r, [codigo]: novas }));
  }

  const datasAlteradas = todosItens.filter((it) => {
    const d = datasAtuais(it);
    return d.inicio !== it.inicioPlanejado || d.fim !== it.fimPlanejado;
  });
  const invalidos = todosItens.filter((it) => datasAtuais(it).fim < datasAtuais(it).inicio).length;
  const mudaObra = datasAlteradas.length > 0 || predAlteradas > 0;
  const temMudanca = mudaObra || avancosAlterados.length > 0;

  // Avisa antes de fechar/recarregar a página com alteração não salva.
  useEffect(() => {
    if (!temMudanca) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [temMudanca]);

  function obraComRascunho(): Obra {
    return {
      ...obra,
      etapas: etapasComPred.map((e) => ({
        ...e,
        atividades: e.atividades.map((a) => ({
          ...a,
          itens: a.itens.map((it) => {
            const d = datasAtuais(it);
            return d.inicio !== it.inicioPlanejado || d.fim !== it.fimPlanejado ? { ...it, inicioPlanejado: d.inicio, fimPlanejado: d.fim } : it;
          }),
        })),
      })),
    };
  }

  function descartar() {
    setRascunho({});
    setRascunhoPred({});
    setRascunhoPct({});
    setPredAberta(null);
    setDesviosPendentes(null);
    setJustificativa('');
  }

  /** Clique em Salvar: se algum prazo passou de 5 d.u. da baseline inicial, pede justificativa antes. */
  function pedirSalvar() {
    if (invalidos > 0) {
      toast.error(`${plural(invalidos, 'item', 'itens')} com fim antes do início. Corrija antes de salvar.`);
      return;
    }
    const desvios = mudaObra && base ? desviosParaJustificar(obra, obraComRascunho()) : [];
    if (desvios.length) {
      setDesviosPendentes(desvios);
      return;
    }
    gravar();
  }

  function gravar(just?: string) {
    const nDatas = datasAlteradas.length;
    const nAv = avancosAlterados.length;
    const primeiro = !base;
    try {
      if (mudaObra) atualizarObra(obraComRascunho(), { justificativa: just });
      if (primeiro && todosItens.length > 0) congelarBaseline(obra.id); // primeiro save grava a baseline inicial
      for (const it of avancosAlterados) lancarApontamento({ obraId: obra.id, itemId: it.id, percentualNovo: rascunhoPct[it.id]! });
      const partes = [
        nDatas && plural(nDatas, 'data alterada', 'datas alteradas'),
        predAlteradas && plural(predAlteradas, 'etapa com predecessoras', 'etapas com predecessoras'),
        nAv && plural(nAv, 'avanço lançado', 'avanços lançados'),
      ].filter(Boolean);
      toast.success(`Cronograma salvo: ${partes.join(', ')}.`, {
        description: primeiro ? 'Baseline inicial gravada. A partir de agora o atraso é medido contra ela.' : just ? 'Justificativa registrada no histórico.' : undefined,
      });
      descartar();
    } catch (e) {
      toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // ---------------------------------------------------------------- Gantt
  // Ao montar (e ao trocar a data de referência), rola o Gantt para a linha "hoje" ficar visível.
  const rolagemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const caixa = rolagemRef.current;
    const marca = caixa?.querySelector<HTMLElement>('[data-hoje]');
    if (!caixa || !marca || caixa.scrollWidth <= caixa.clientWidth) return;
    const x = marca.getBoundingClientRect().left - caixa.getBoundingClientRect().left + caixa.scrollLeft;
    caixa.scrollLeft = Math.max(0, x - caixa.clientWidth * 0.7);
  }, [hoje, obra.id, visao]);

  const escala = useMemo(() => {
    let ini = obra.dataInicio;
    let fim = obra.dataInicio;
    for (const it of todosItens) {
      const d = reprog.datas[it.id] ?? rascunho[it.id] ?? { inicio: it.inicioPlanejado, fim: it.fimPlanejado };
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
  }, [obra.dataInicio, todosItens, base, rascunho, reprog]);

  const pos = (d: ISODate) => (diasEntre(escala.ini, d) / escala.total) * 100;
  const larg = (d: Datas) => ((diasEntre(d.inicio, d.fim) + 1) / escala.total) * 100;
  const posHoje = hoje >= escala.ini && hoje <= escala.fim ? pos(hoje) : null;

  function agregarItens(itens: ItemAtividade[]): Agregado {
    const tot = itens.reduce((s, i) => s + i.valorOrcado, 0) || itens.length || 1;
    const peso = (i: ItemAtividade) => (itens.reduce((s, x) => s + x.valorOrcado, 0) ? i.valorOrcado : 1);
    const realizado = itens.reduce((s, i) => s + (pctDe(i) / 100) * peso(i), 0) / tot;
    const planejado = itens.reduce((s, i) => s + planejadoItem(obra, i.id, hoje) * peso(i), 0) / tot;
    const spi = planejado > 0 ? realizado / planejado : null;
    const concluida = itens.length > 0 && itens.every((i) => pctDe(i) >= 100);
    return {
      realizado,
      planejado,
      spi,
      faixa: faixaPorSpi(spi, realizado, concluida),
      base: spanDe(itens.map(datasBase).filter((d): d is Datas => d != null)),
      atual: spanDe(itens.map(datasAtuais)) ?? { inicio: obra.dataInicio, fim: obra.dataInicio },
      execucao: itens.length > 1 ? diasDeExecucao(itens.map(datasAtuais)) : 0,
    };
  }

  const alternar = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  // ---------------------------------------------------------------- células (funções, não componentes: não remontam inputs)
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
            title={`Baseline inicial: ${formatData(b.inicio)} a ${formatData(b.fim)}`}
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

  function celulasNumeros(g: Agregado, item?: ItemAtividade) {
    return (
      <>
        <td className="px-2 text-right tabular-nums text-gray-900">
          {item ? (
            <div className="inline-flex items-center justify-end gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={pctDe(item)}
                onChange={(e) => {
                  mudarPct(item, e.target.value);
                  if (/^0\d/.test(e.target.value)) e.target.value = String(Number(e.target.value)); // "040" -> "40"
                }}
                onFocus={(e) => e.target.select()}
                className={cn(
                  'h-7 w-16 px-1.5 text-right text-xs tabular-nums',
                  pctDe(item) !== item.percentual && 'border-accent bg-accent/5 font-semibold',
                  pctDe(item) < item.percentual && 'border-saude-amarelo',
                )}
                aria-label={`Avanço realizado (salvo: ${item.percentual}%)`}
                title={pctDe(item) < item.percentual ? `Abaixo do salvo (${item.percentual}%): será lançado como correção.` : undefined}
              />
              <span className="text-xs text-muted">%</span>
            </div>
          ) : (
            formatPctFracao(g.realizado, 0)
          )}
        </td>
        <td className="px-2 text-right tabular-nums text-muted">{formatPctFracao(g.planejado, 0)}</td>
        <td className="whitespace-nowrap px-2 text-right tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            {formatSPI(g.spi)}
            <SaudePonto faixa={g.faixa} />
          </span>
        </td>
      </>
    );
  }

  /** Duração em dias úteis. Etapa e atividade com vários locais = do primeiro início ao último fim. */
  function celulaDuracao(atual: Datas, baseD: Datas | null, item?: ItemAtividade, execucao = 0) {
    const du = atual.fim < atual.inicio ? 0 : contarDiasUteis(atual.inicio, atual.fim);
    const duBase = baseD ? contarDiasUteis(baseD.inicio, baseD.fim) : null;
    const dif = duBase != null ? du - duBase : 0;
    if (item && podeEditarDatas) {
      return (
        <td className="whitespace-nowrap px-2 text-right text-xs">
          <div className="inline-flex items-center gap-1">
            {/* key com as datas: se o fim mudar pela data, o campo recarrega com a nova duração. */}
            <Input
              key={`${item.id}-${atual.inicio}-${atual.fim}`}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              defaultValue={du || ''}
              onBlur={(e) => mudarDuracao(item, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onFocus={(e) => e.target.select()}
              className={cn('h-7 w-14 px-1.5 text-right text-xs tabular-nums', dif !== 0 && 'border-saude-amarelo')}
              aria-label="Duração em dias úteis"
              title={`Dias úteis. O fim é recalculado a partir do início.${duBase != null ? ` Baseline inicial: ${duBase} d.u.` : ''}`}
            />
            <span className="text-muted">d.u.</span>
          </div>
        </td>
      );
    }
    return (
      <td className="whitespace-nowrap px-2 text-right text-xs tabular-nums text-gray-700">
        <Dica
          texto={[
            `Prazo: ${du} dias úteis, do primeiro início ao último fim`,
            execucao > 0 && execucao < du ? `Execução: ${execucao} dias úteis com algum local trabalhando (o resto é intervalo entre locais)` : '',
            duBase != null ? `Baseline inicial: ${duBase} dias úteis` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <span>
            {du} d.u.
            {dif !== 0 && <span className={cn('ml-1 font-medium', dif > 0 ? 'text-saude-amarelo' : 'text-saude-verde')}>({sinal(dif)})</span>}
            {execucao > 0 && execucao < du && <span className="block text-[10px] text-muted">{execucao} de execução</span>}
          </span>
        </Dica>
      </td>
    );
  }

  function celulasDatas(g: Agregado, item?: ItemAtividade) {
    const d = item ? datasAtuais(item) : g.atual;
    const mudou = g.base && (g.base.inicio !== d.inicio || g.base.fim !== d.fim);
    const naoSalvo = item && (d.inicio !== item.inicioPlanejado || d.fim !== item.fimPlanejado);
    return (
      <>
        <td className="whitespace-nowrap px-2 text-xs text-muted">{g.base ? `${formatDiaMes(g.base.inicio)} a ${formatDiaMes(g.base.fim)}` : 'sem baseline'}</td>
        <td className={cn('whitespace-nowrap px-2 text-xs', mudou ? 'font-medium text-saude-amarelo' : 'text-gray-700')}>
          {item && podeEditarDatas ? (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={d.inicio}
                onChange={(e) => mudarData(item, 'inicio', e.target.value)}
                className={cn('h-7 w-[7.6rem] px-1.5 text-xs', naoSalvo && 'border-accent bg-accent/5')}
                aria-label="Início atual"
              />
              <Input
                type="date"
                value={d.fim}
                onChange={(e) => mudarData(item, 'fim', e.target.value)}
                className={cn('h-7 w-[7.6rem] px-1.5 text-xs', naoSalvo && 'border-accent bg-accent/5', d.fim < d.inicio && 'border-saude-vermelho')}
                aria-label="Fim atual"
              />
            </div>
          ) : (
            `${formatDiaMes(d.inicio)} a ${formatDiaMes(d.fim)}`
          )}
        </td>
        {celulaDuracao(d, g.base, item, item ? 0 : g.execucao)}
      </>
    );
  }

  /** Filtro de andar do Gantt: itens do local escolhido + os de "obra toda". */
  const filtrar = (itens: ItemAtividade[]) =>
    filtroLocal === 'todos' ? itens : itens.filter((i) => i.localId === filtroLocal || locais.get(i.localId)?.tipo === 'obra');

  function linhaAtividade(atv: Atividade) {
    const a = { ...atv, itens: filtrar(atv.itens) };
    if (!a.itens.length) return null;
    const g = agregarItens(a.itens);
    const unico = a.itens.length === 1 ? a.itens[0] : undefined;
    const aberta = !locaisFechados.has(a.id);
    return (
      <>
        <tr className="border-b border-border hover:bg-gray-50/60">
          <td className="w-[360px] py-1.5 pl-8 pr-2 align-top">
            <div className="flex items-start gap-1.5">
              {!unico ? (
                <button
                  className="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-muted hover:bg-gray-100"
                  onClick={() => setLocaisFechados((s) => alternar(s, a.id))}
                  aria-label={aberta ? 'Recolher locais' : 'Expandir locais'}
                >
                  {aberta ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </button>
              ) : (
                <span className="w-4.5 shrink-0" />
              )}
              <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted">{a.codigo}</span>
              <div className="min-w-0">
                <div className="break-words text-sm leading-snug text-gray-900">{a.nome}</div>
                {(!unico || (unico && locais.get(unico.localId)?.tipo !== 'obra') || !a.duracaoConfirmada) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                    {!unico && (
                      <button className="cursor-pointer hover:text-gray-900 hover:underline" onClick={() => setLocaisFechados((s) => alternar(s, a.id))}>
                        {a.itens.length} locais{!aberta && ' (abrir para editar)'}
                      </button>
                    )}
                    {unico && locais.get(unico.localId)?.tipo !== 'obra' && <span>{locais.get(unico.localId)?.nome}</span>}
                    {!a.duracaoConfirmada && (
                      <Dica texto="Duração estimada pelo modelo, ainda não validada">
                        <Badge variant="estimativa" className="px-1.5 py-0 text-[10px]">NÃO CONFIRMADO</Badge>
                      </Dica>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
          {celulasDatas(unico ? { ...g, base: datasBase(unico) } : g, unico)}
          {celulasNumeros(g, unico)}
          <td className="min-w-[400px] px-2">{barraGantt(g.base, unico ? datasAtuais(unico) : g.atual, g.faixa)}</td>
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
                  {celulasNumeros(gi, it)}
                  <td className="px-2">{barraGantt(gi.base, datasAtuais(it), gi.faixa, true)}</td>
                </tr>
              );
            })}
      </>
    );
  }

  const semItens = todosItens.length === 0;
  const spanObra = spanDe(todosItens.map(datasAtuais));
  const spanObraBase = spanDe(todosItens.map(datasBase).filter((d): d is Datas => d != null));
  const alteracoes = [...(obra.alteracoes ?? [])].reverse();

  return (
    <div className="space-y-4">
      {/* Botão de salvar: canto superior direito, só aparece com alteração pendente. */}
      {temMudanca && (
        <div className="fixed right-4 top-[4.5rem] z-40 flex items-center gap-2 rounded-xl border border-accent/30 bg-surface px-3 py-2 shadow-lg sm:right-6">
          <span className="hidden text-xs text-gray-700 sm:inline">
            {[
              datasAlteradas.length && plural(datasAlteradas.length, 'data', 'datas'),
              predAlteradas && plural(predAlteradas, 'predecessora', 'predecessoras'),
              avancosAlterados.length && plural(avancosAlterados.length, 'avanço', 'avanços'),
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            pendente{datasAlteradas.length + predAlteradas + avancosAlterados.length === 1 ? '' : 's'}
            {reprog.empurradas.length > 0 && <span className="text-accent"> · {plural(reprog.empurradas.length, 'etapa empurrada', 'etapas empurradas')}</span>}
            {invalidos > 0 && <span className="text-saude-vermelho"> · {invalidos} com fim antes do início</span>}
          </span>
          <Button variant="ghost" size="sm" onClick={descartar}>
            <X /> Descartar
          </Button>
          <Button size="sm" onClick={pedirSalvar} disabled={invalidos > 0}>
            <Save /> Salvar
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cronograma</CardTitle>
          <CardDescription>
            Edite direto na tabela{podeEditarDatas ? ' (datas, duração, predecessoras e % realizado)' : ' (% realizado)'} e clique em Salvar no canto superior
            direito. Mudança de prazo a mais de {LIMITE_JUSTIFICATIVA_DU} dias úteis da baseline inicial pede justificativa. Barra cinza = baseline inicial; barra
            colorida = datas atuais; linha preta = hoje.
          </CardDescription>
          {spanObra && (
            <div className="mt-2 text-sm text-gray-900">
              Duração total: <strong className="tabular-nums">{contarDiasUteis(spanObra.inicio, spanObra.fim)} dias úteis</strong>
              <span className="text-muted">
                {' '}
                ({formatData(spanObra.inicio)} a {formatData(spanObra.fim)}
                {spanObraBase ? `; baseline inicial: ${contarDiasUteis(spanObraBase.inicio, spanObraBase.fim)} dias úteis` : '; sem baseline: o primeiro save grava a inicial'})
              </span>
            </div>
          )}
          {temAndares && !semItens && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Visão do cronograma">
                {(
                  [
                    ['andar', 'Por andar (lançar avanço)'],
                    ['etapa', 'Por etapa (prazos)'],
                  ] as const
                ).map(([v, rotulo]) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={visao === v}
                    onClick={() => setVisao(v)}
                    className={cn('cursor-pointer rounded-md px-3 py-1 text-sm font-medium', visao === v ? 'bg-accent text-white' : 'text-gray-700 hover:bg-gray-100')}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {visao === 'etapa' && (
                <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filtrar por andar">
                  <span className="mr-1 text-xs text-muted">Andar:</span>
                  {[{ id: 'todos', nome: 'Todos' }, ...obra.locais.filter((l) => l.tipo !== 'obra').sort((a, b) => a.ordem - b.ordem)].map((l) => (
                    <button
                      key={l.id}
                      role="tab"
                      aria-selected={filtroLocal === l.id}
                      onClick={() => setFiltroLocal(l.id)}
                      className={cn(
                        'cursor-pointer rounded-full border px-2.5 py-0.5 text-xs',
                        filtroLocal === l.id ? 'border-accent bg-accent text-white' : 'border-border text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      {l.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {semItens ? (
            <div className="px-5 py-8 text-center text-sm text-muted">Esta obra ainda não tem atividades no cronograma.</div>
          ) : visao === 'andar' && temAndares ? (
            <GradePorAndar obra={obra} hoje={hoje} pctDe={pctDe} mudarPct={mudarPct} definirPct={definirPct} datasDe={datasAtuais} />
          ) : (
            <div className="overflow-x-auto" ref={rolagemRef}>
              <table className="w-full min-w-[1280px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                    <th className="w-[360px] px-5 py-2">Etapa / atividade / local</th>
                    <th className="px-2 py-2">Baseline</th>
                    <th className="px-2 py-2">Atual</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right">
                      <Dica texto="Dias úteis (sem fins de semana e feriados). Entre parênteses: diferença para a baseline inicial.">
                        <span>Duração</span>
                      </Dica>
                    </th>
                    <th className="px-2 py-2 text-right">Real.</th>
                    <th className="px-2 py-2 text-right">Plan.</th>
                    <th className="px-2 py-2 text-right">SPI</th>
                    <th className="px-2 py-2">
                      <div className="relative h-4">
                        {escala.meses.map((m) => (
                          <span key={m.rotulo} className="absolute text-[10px] font-medium" style={{ left: `${m.pos}%` }}>
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
                    const itens = filtrar(e.atividades.flatMap((a) => a.itens));
                    if (!itens.length) return null;
                    // Sem filtro, a etapa usa os indicadores oficiais; com filtro de andar, agrega só os itens visíveis.
                    const g = filtroLocal === 'todos' ? { ...agregarItens(itens), realizado: ie.realizado, planejado: ie.planejado, spi: ie.spi, faixa: ie.faixa } : agregarItens(itens);
                    const aberta = !fechadas.has(e.codigo);
                    const preds = predDe(e);
                    return (
                      <Fragment key={e.codigo}>
                        <tr className="border-b border-border bg-gray-50">
                          <td className="w-[360px] py-1.5 pl-3 pr-2">
                            <button
                              className="flex w-full min-w-0 cursor-pointer items-start gap-1.5 text-left font-semibold text-gray-900"
                              onClick={() => setFechadas((s) => alternar(s, e.codigo))}
                            >
                              {aberta ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted" />}
                              <span className="min-w-0 break-words leading-snug">
                                {e.codigo}. {e.nome}
                              </span>
                            </button>
                            {(preds.length > 0 || podeEditarDatas || violacaoPor.has(e.codigo)) && (
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-5.5 text-xs font-normal">
                                {preds.length > 0 && (
                                  <Dica texto={`Só começa depois que terminar: ${preds.map((p) => `${p}. ${obra.etapas.find((x) => x.codigo === p)?.nome ?? '?'}`).join('; ')}`}>
                                    <span className="inline-flex items-center gap-1 text-muted">
                                      <Link2 className="size-3" /> após {preds.join(', ')}
                                    </span>
                                  </Dica>
                                )}
                                {podeEditarDatas && (
                                  <button className="cursor-pointer text-accent hover:underline" onClick={() => setPredAberta(e.codigo)}>
                                    {preds.length ? 'alterar' : '+ predecessora'}
                                  </button>
                                )}
                                {empurradaPor.has(e.codigo) && (
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] text-accent">
                                    empurrada +{empurradaPor.get(e.codigo)} d.u.
                                  </Badge>
                                )}
                                {violacaoPor.has(e.codigo) && (
                                  <Dica texto={`Já iniciada, então não foi movida. Pela sequência só poderia começar em ${formatData(violacaoPor.get(e.codigo)!)}.`}>
                                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] text-saude-vermelho">
                                      fora da sequência
                                    </Badge>
                                  </Dica>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 text-xs text-muted">{g.base ? `${formatDiaMes(g.base.inicio)} a ${formatDiaMes(g.base.fim)}` : 'sem baseline'}</td>
                          <td className="whitespace-nowrap px-2 text-xs text-gray-700">{`${formatDiaMes(g.atual.inicio)} a ${formatDiaMes(g.atual.fim)}`}</td>
                          {celulaDuracao(g.atual, g.base, undefined, g.execucao)}
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
            <History className="size-4" /> Histórico de alterações de prazo
          </CardTitle>
          <CardDescription>Saves que mudaram etapa ou atividade para mais de {LIMITE_JUSTIFICATIVA_DU} dias úteis da baseline inicial, com a justificativa.</CardDescription>
        </CardHeader>
        <CardContent>
          {!base ? (
            <div className="text-sm text-muted">Sem baseline inicial ainda. Ela é gravada no primeiro save do cronograma.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2.5 text-sm">
                <Badge>Baseline inicial</Badge>
                <div className="min-w-0 flex-1 text-gray-900">
                  Gravada em {formatData(base.congeladaEm)} por {nomeUsuario(base.autorId)}. É fixa: o atraso é sempre medido contra ela.
                </div>
                {spanObraBase && <div className="text-xs text-muted">fim previsto {formatData(spanObraBase.fim)}</div>}
              </div>
              {obra.baselines.length > 1 && (
                <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted">
                  Versões antigas (de antes da baseline fixa), só para consulta:{' '}
                  {obra.baselines
                    .slice(1)
                    .map((b) => `v${b.versao} em ${formatData(b.congeladaEm)}${b.justificativa ? ` (${b.justificativa})` : ''}`)
                    .join('; ')}
                  .
                </div>
              )}
              {alteracoes.length === 0 ? (
                <div className="text-sm text-muted">Nenhuma alteração de prazo acima de {LIMITE_JUSTIFICATIVA_DU} dias úteis até agora.</div>
              ) : (
                <ol className="space-y-2">
                  {alteracoes.map((al) => (
                    <li key={al.id} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-gray-900">
                          {formatData(al.data)} · {nomeUsuario(al.autorId)}
                        </span>
                        <span className="text-xs text-muted">{plural(al.itens.length, 'item', 'itens')}</span>
                      </div>
                      <div className="mt-1 text-gray-800">“{al.justificativa}”</div>
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                        {al.itens.map((d) => (
                          <li key={`${d.tipo}-${d.codigo}`}>
                            {d.tipo === 'etapa' ? 'Etapa' : 'Atividade'} {d.codigo} {d.nome}: {formatDiaMes(d.antes.inicio)} a {formatDiaMes(d.antes.fim)} →{' '}
                            <span className="text-gray-800">
                              {formatDiaMes(d.depois.inicio)} a {formatDiaMes(d.depois.fim)}
                            </span>{' '}
                            (vs. baseline: início {sinal(d.desvioInicio)}, fim {sinal(d.desvioFim)} d.u.)
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escolha das predecessoras de uma etapa. */}
      {predAberta != null &&
        (() => {
          const alvoEtapa = obra.etapas.find((x) => x.codigo === predAberta);
          if (!alvoEtapa) return null;
          // Quem depende desta etapa (direta ou indiretamente) não pode virar predecessora: criaria ciclo.
          const bloqueadas = sucessorasTransitivas(etapasComPred, predAberta);
          const marcadas = predDe(alvoEtapa);
          return (
            <Dialog open onOpenChange={(o) => !o && setPredAberta(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Predecessoras de {alvoEtapa.codigo}. {alvoEtapa.nome}
                  </DialogTitle>
                  <DialogDescription>
                    Esta etapa só começa no dia útil seguinte ao fim das etapas marcadas. Se ela estiver antes disso, é empurrada para frente (junto com quem depende
                    dela). Etapa já iniciada não é movida. Só vale depois de Salvar.
                  </DialogDescription>
                </DialogHeader>
                <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
                  {obra.etapas
                    .filter((x) => x.codigo !== predAberta && x.atividades.length > 0)
                    .map((x) => {
                      const ciclo = bloqueadas.has(x.codigo) && !marcadas.includes(x.codigo);
                      return (
                        <li key={x.codigo}>
                          <label
                            className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm', ciclo ? 'cursor-not-allowed text-muted' : 'cursor-pointer hover:bg-gray-50')}
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--color-accent)]"
                              checked={marcadas.includes(x.codigo)}
                              disabled={ciclo}
                              onChange={() => alternarPred(predAberta, x.codigo)}
                            />
                            <span className="tabular-nums">{x.codigo}.</span> {x.nome}
                            {ciclo && <span className="ml-auto text-xs">depende desta etapa</span>}
                          </label>
                        </li>
                      );
                    })}
                </ul>
                <DialogFooter>
                  <Button onClick={() => setPredAberta(null)}>Pronto</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}

      {/* Justificativa: mudança de prazo a mais de 5 d.u. da baseline inicial. */}
      <Dialog open={desviosPendentes != null} onOpenChange={(o) => !o && setDesviosPendentes(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Justifique a alteração de prazo</DialogTitle>
            <DialogDescription>
              {plural(desviosPendentes?.length ?? 0, 'item ficou', 'itens ficaram')} a mais de {LIMITE_JUSTIFICATIVA_DU} dias úteis da baseline inicial. A justificativa vai
              para o histórico da obra, e a baseline inicial não muda.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {desviosPendentes?.map((d) => (
              <li key={`${d.tipo}-${d.codigo}`}>
                <strong>
                  {d.tipo === 'etapa' ? 'Etapa' : 'Atividade'} {d.codigo}
                </strong>{' '}
                {d.nome}: baseline {formatDiaMes(d.base.inicio)} a {formatDiaMes(d.base.fim)} → {formatDiaMes(d.depois.inicio)} a {formatDiaMes(d.depois.fim)}{' '}
                <span className="text-saude-amarelo">
                  (início {sinal(d.desvioInicio)}, fim {sinal(d.desvioFim)} d.u.)
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="just">Justificativa (obrigatória)</Label>
            <Textarea
              id="just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: chuvas acima da média em novembro atrasaram a estrutura do 2º pavimento."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesviosPendentes(null)}>
              Voltar
            </Button>
            <Button onClick={() => gravar(justificativa.trim())} disabled={justificativa.trim().length < 5}>
              <Save /> Salvar com justificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
