/**
 * Grade de lançamento "Por andar" do Cronograma (plano 2026-11-11-16-20, A1).
 * Linhas = atividades agrupadas por etapa; colunas = pavimentos/unidades (+ "Obra toda").
 * Cada célula é o % de UM item (atividade naquele local) e é editável; vai para o rascunho do Cronograma
 * e é salva pelo botão Salvar dele. Célula cinza = a atividade não existe naquele local.
 */
import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { faixaPorSpi, planejadoItem, type FaixaSaude, type ISODate, type ItemAtividade, type Local, type Obra } from '@obras/shared';
import { ORDEM_FAIXAS, SAUDE, SaudePonto } from '@/components/ui';
import { formatData, formatPct, formatPctFracao, formatSPI } from '@/lib/format';
import { cn } from '@/lib/utils';

/** "#rrggbb" + alfa → rgba(). */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const OBRA_TODA = '__obra__';

export function GradePorAndar({
  obra,
  hoje,
  pctDe,
  mudarPct,
  definirPct,
  datasDe,
}: {
  obra: Obra;
  hoje: ISODate;
  pctDe: (it: ItemAtividade) => number;
  mudarPct: (it: ItemAtividade, valor: string) => void;
  /** Define o mesmo % em vários itens (atalho "etapa concluída neste andar"). */
  definirPct: (itens: ItemAtividade[], valor: number) => void;
  datasDe: (it: ItemAtividade) => { inicio: ISODate; fim: ISODate };
}) {
  const [fechadas, setFechadas] = useState<Set<number>>(new Set());

  /** Colunas: locais com itens, na ordem da obra; "Obra toda" por último, se houver item nela. */
  const colunas = useMemo(() => {
    const usados = new Set(obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens.map((i) => i.localId))));
    const tipoObra = new Set(obra.locais.filter((l) => l.tipo === 'obra').map((l) => l.id));
    const pav: { id: string; nome: string; local?: Local }[] = obra.locais
      .filter((l) => l.tipo !== 'obra' && usados.has(l.id))
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => ({ id: l.id, nome: l.nome, local: l }));
    const temObraToda = [...usados].some((id) => tipoObra.has(id));
    return { lista: temObraToda ? [...pav, { id: OBRA_TODA, nome: 'Obra toda' }] : pav, tipoObra };
  }, [obra.locais, obra.etapas]);

  const colunaDe = (it: ItemAtividade) => (colunas.tipoObra.has(it.localId) ? OBRA_TODA : it.localId);

  function saude(itens: ItemAtividade[]): { real: number; plan: number; spi: number | null; faixa: FaixaSaude } {
    const somaValor = itens.reduce((s, i) => s + i.valorOrcado, 0);
    const peso = (i: ItemAtividade) => (somaValor ? i.valorOrcado : 1);
    const tot = somaValor || itens.length || 1;
    const real = itens.reduce((s, i) => s + (pctDe(i) / 100) * peso(i), 0) / tot;
    let plan = 0;
    try {
      plan = itens.reduce((s, i) => s + planejadoItem(obra, i.id, hoje) * peso(i), 0) / tot;
    } catch {
      plan = 0;
    }
    const spi = plan > 0 ? real / plan : null;
    return { real, plan, spi, faixa: faixaPorSpi(spi, real, itens.length > 0 && itens.every((i) => pctDe(i) >= 100)) };
  }

  const porColuna = (itens: ItemAtividade[]) => {
    const m = new Map<string, ItemAtividade[]>();
    for (const i of itens) {
      const c = colunaDe(i);
      m.set(c, [...(m.get(c) ?? []), i]);
    }
    return m;
  };

  const resumoColuna = useMemo(
    () => porColuna(obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obra.etapas, colunas],
  );

  function celula(it: ItemAtividade | undefined, rotulo: string, colNome: string) {
    if (!it) return <td className="rounded bg-gray-50" title={`${rotulo}: não se aplica a ${colNome}`} />;
    const p = pctDe(it);
    const s = saude([it]);
    const cor = SAUDE[s.faixa];
    const mudou = p !== it.percentual;
    const d = datasDe(it);
    const bg = s.faixa === 'nao_iniciada' && !mudou ? '#f9fafb' : rgba(cor.hex, 0.1 + (0.35 * p) / 100);
    return (
      <td className="h-9 rounded p-0.5 align-middle" style={{ background: bg, boxShadow: `inset 3px 0 0 ${cor.hex}` }}>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          inputMode="numeric"
          value={p}
          onChange={(e) => {
            mudarPct(it, e.target.value);
            if (/^0\d/.test(e.target.value)) e.target.value = String(Number(e.target.value)); // "040" -> "40"
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-8 w-full min-w-12 rounded border bg-white/70 px-1 text-center text-xs font-semibold tabular-nums outline-none focus:border-accent focus:bg-white',
            mudou ? 'border-accent text-accent' : 'border-transparent text-gray-900',
            p < it.percentual && 'border-saude-amarelo text-saude-amarelo',
          )}
          aria-label={`${rotulo} · ${colNome}: % realizado`}
          title={[
            `${rotulo} · ${colNome}`,
            `Realizado ${formatPct(p, 0)}${mudou ? ` (salvo: ${it.percentual}%)` : ''} · planejado até hoje ${formatPctFracao(s.plan, 0)} · SPI ${formatSPI(s.spi)}`,
            `Datas: ${formatData(d.inicio)} a ${formatData(d.fim)}`,
            `Saúde: ${cor.rotulo}`,
          ].join('\n')}
        />
      </td>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-3 text-xs text-gray-700">
        <span className="text-muted">Digite o % de cada atividade em cada local. Cor = saúde (contra a baseline inicial); intensidade = quanto já foi feito.</span>
        {ORDEM_FAIXAS.map((f) => (
          <span key={f} className="inline-flex items-center gap-1.5">
            <SaudePonto faixa={f} /> {SAUDE[f].rotulo}
          </span>
        ))}
      </div>
      <div className="max-h-[75vh] overflow-auto">
        <table className="border-separate border-spacing-0.5 text-xs">
          <thead className="sticky top-0 z-20 bg-surface">
            <tr>
              <th className="sticky left-0 z-30 min-w-72 bg-surface px-5 py-2 text-left font-semibold text-muted">Etapa / atividade</th>
              {colunas.lista.map((c) => {
                const r = saude(resumoColuna.get(c.id) ?? []);
                return (
                  <th key={c.id} className="min-w-20 px-1 pb-1 text-center align-bottom font-semibold text-gray-900">
                    <div className="max-w-28 truncate" title={c.nome}>
                      {c.nome}
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 font-normal text-muted">
                      <SaudePonto faixa={r.faixa} className="size-2" />
                      {formatPctFracao(r.real, 0)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {obra.etapas.map((e) => {
              const ativs = e.atividades.filter((a) => a.itens.length > 0);
              if (!ativs.length) return null;
              const aberta = !fechadas.has(e.codigo);
              const daEtapa = porColuna(ativs.flatMap((a) => a.itens));
              return (
                <Fragment key={e.codigo}>
                  <tr>
                    <td className="sticky left-0 z-10 bg-gray-100 px-3 py-1.5">
                      <button
                        className="flex cursor-pointer items-center gap-1 text-left font-semibold text-gray-900"
                        onClick={() =>
                          setFechadas((s) => {
                            const n = new Set(s);
                            if (n.has(e.codigo)) n.delete(e.codigo);
                            else n.add(e.codigo);
                            return n;
                          })
                        }
                      >
                        {aberta ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />}
                        {e.codigo}. {e.nome}
                      </button>
                    </td>
                    {colunas.lista.map((c) => {
                      const itens = daEtapa.get(c.id);
                      if (!itens) return <td key={c.id} className="rounded bg-gray-100" />;
                      const r = saude(itens);
                      const completa = itens.every((i) => pctDe(i) >= 100);
                      return (
                        <td key={c.id} className="group rounded bg-gray-100 px-1 text-center">
                          <div className="flex items-center justify-center gap-1 tabular-nums">
                            <SaudePonto faixa={r.faixa} className="size-2" />
                            <span className="font-semibold text-gray-900">{formatPctFracao(r.real, 0)}</span>
                            {!completa && (
                              <button
                                className="cursor-pointer rounded p-0.5 text-muted opacity-0 hover:bg-white hover:text-accent focus:opacity-100 group-hover:opacity-100"
                                onClick={() => definirPct(itens, 100)}
                                title={`Marcar ${e.nome} como concluída em ${c.nome} (100% em ${itens.length} atividade${itens.length === 1 ? '' : 's'})`}
                                aria-label={`Concluir etapa ${e.codigo} em ${c.nome}`}
                              >
                                <Check className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {aberta &&
                    ativs.map((a) => {
                      const m = porColuna(a.itens);
                      const rotulo = `${a.codigo} ${a.nome}`;
                      return (
                        <tr key={a.id}>
                          <td className="sticky left-0 z-10 max-w-72 bg-surface py-0.5 pl-8 pr-2">
                            <div className="truncate text-gray-900" title={rotulo}>
                              <span className="text-muted">{a.codigo}</span> {a.nome}
                            </div>
                          </td>
                          {colunas.lista.map((c) => (
                            <Fragment key={c.id}>{celula(m.get(c.id)?.[0], rotulo, c.nome)}</Fragment>
                          ))}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
