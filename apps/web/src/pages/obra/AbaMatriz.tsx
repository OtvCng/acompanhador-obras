import { useMemo } from 'react';
import { baselineVigente, faixaPorSpi, indicadoresLocal, planejadoItem, type FaixaSaude, type ItemAtividade, type Obra } from '@obras/shared';
import { useObras } from '@/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, ORDEM_FAIXAS, SAUDE, SaudePonto } from '@/components/ui';
import { diasEntre, formatData, formatDiaMes, formatPct, formatPctFracao, formatSPI } from '@/lib/format';

interface Celula {
  item: ItemAtividade;
  planejado: number; // 0..1
  spi: number | null;
  faixa: FaixaSaude;
}

/** Converte "#rrggbb" + alfa em rgba(). */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function AbaMatriz({ obra }: { obra: Obra }) {
  const { hoje } = useObras();
  const base = baselineVigente(obra);

  const dados = useMemo(() => {
    const colunas = obra.locais.filter((l) => l.tipo !== 'obra').sort((a, b) => a.ordem - b.ordem);
    const idsColunas = new Set(colunas.map((c) => c.id));
    const linhas = obra.etapas.flatMap((e) =>
      e.atividades
        .filter((a) => a.itens.some((i) => idsColunas.has(i.localId)))
        .map((a) => {
          const celulas = new Map<string, Celula>();
          for (const item of a.itens) {
            const planejado = planejadoItem(obra, item.id, hoje);
            const real = item.percentual / 100;
            const spi = planejado > 0 ? real / planejado : null;
            celulas.set(item.localId, { item, planejado, spi, faixa: faixaPorSpi(spi, real, item.percentual >= 100) });
          }
          return { etapa: e, atividade: a, celulas };
        }),
    );
    const resumoLocal = new Map(colunas.map((l) => [l.id, indicadoresLocal(obra, l, hoje)]));
    // Ciclo de cada local: do primeiro início ao último fim (baseline vigente, ou datas atuais sem baseline).
    const ciclo = new Map<string, { inicio: string; fim: string } | null>();
    for (const l of colunas) {
      let ini: string | null = null;
      let fim: string | null = null;
      for (const lin of linhas) {
        const c = lin.celulas.get(l.id);
        if (!c) continue;
        const b = base?.itens[c.item.id];
        const i0 = b?.inicio ?? c.item.inicioPlanejado;
        const f0 = b?.fim ?? c.item.fimPlanejado;
        if (!ini || i0 < ini) ini = i0;
        if (!fim || f0 > fim) fim = f0;
      }
      ciclo.set(l.id, ini && fim ? { inicio: ini, fim } : null);
    }
    return { colunas, linhas, resumoLocal, ciclo };
  }, [obra, hoje, base]);

  if (dados.colunas.length === 0 || dados.linhas.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        Esta obra é executada como um local único (sem pavimentos nem unidades), então não há matriz por local. Veja o andamento na aba Cronograma.
      </Card>
    );
  }

  const porUnidade = dados.colunas.some((c) => c.tipo === 'unidade');
  const titulo = porUnidade ? 'Matriz atividade x unidade' : 'Matriz atividade x pavimento';
  const leitura = porUnidade
    ? 'A leitura em diagonal mostra as equipes passando de casa em casa.'
    : 'A leitura em diagonal mostra o ciclo da obra subindo pavimento a pavimento.';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>
          Cada célula é uma atividade {porUnidade ? 'numa unidade' : 'num pavimento'}: número = % realizado; cor = saúde do item; intensidade = quanto já foi feito.{' '}
          {leitura}
        </CardDescription>
        <div className="flex flex-wrap gap-3 pt-1">
          {ORDEM_FAIXAS.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              <SaudePonto faixa={f} /> {SAUDE[f].rotulo}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-64 bg-surface px-5 py-2 text-left font-semibold text-muted">Atividade</th>
                {dados.colunas.map((l) => {
                  const r = dados.resumoLocal.get(l.id);
                  return (
                    <th key={l.id} className="min-w-24 px-1 pb-2 text-center align-bottom font-semibold text-gray-900">
                      <div className="truncate">{l.nome}</div>
                      {r && (
                        <div className="mt-0.5 inline-flex items-center gap-1 font-normal text-muted">
                          <SaudePonto faixa={r.faixa} className="size-2" />
                          {formatPctFracao(r.realizado, 0)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map(({ etapa, atividade, celulas }, k) => {
                const novaEtapa = k === 0 || dados.linhas[k - 1]!.etapa.codigo !== etapa.codigo;
                return (
                  <tr key={atividade.id}>
                    <td className="sticky left-0 z-10 bg-surface px-5 py-0.5">
                      {novaEtapa && <div className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">{etapa.nome}</div>}
                      <div className="truncate text-gray-900">
                        <span className="text-muted">{atividade.codigo}</span> {atividade.nome}
                      </div>
                    </td>
                    {dados.colunas.map((l) => {
                      const c = celulas.get(l.id);
                      if (!c) return <td key={l.id} className="rounded bg-gray-50" title="Não se aplica a este local" />;
                      const s = SAUDE[c.faixa];
                      const p = c.item.percentual;
                      const bg = c.faixa === 'nao_iniciada' ? '#f3f4f6' : rgba(s.hex, 0.12 + (0.55 * p) / 100);
                      const b = base?.itens[c.item.id];
                      return (
                        <td
                          key={l.id}
                          className="h-9 rounded text-center align-middle font-semibold tabular-nums"
                          style={{ background: bg, color: p >= 70 && c.faixa !== 'nao_iniciada' ? '#fff' : '#111827', boxShadow: `inset 3px 0 0 ${s.hex}` }}
                          title={[
                            `${atividade.nome} · ${l.nome}`,
                            `Realizado ${formatPct(p, 0)} · planejado ${formatPctFracao(c.planejado, 0)} · SPI ${formatSPI(c.spi)}`,
                            `Saúde: ${s.rotulo}`,
                            b ? `Baseline ${formatData(b.inicio)} a ${formatData(b.fim)}` : 'Sem baseline',
                          ].join('\n')}
                        >
                          {formatPct(p, 0)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <td className="sticky left-0 z-10 bg-surface px-5 pt-3 font-semibold text-muted">Ciclo {porUnidade ? 'da unidade' : 'do pavimento'} ({base ? 'baseline' : 'datas atuais'})</td>
                {dados.colunas.map((l) => {
                  const c = dados.ciclo.get(l.id);
                  return (
                    <td key={l.id} className="px-1 pt-3 text-center text-[11px] text-gray-700">
                      {c ? (
                        <>
                          <div>
                            {formatDiaMes(c.inicio)} a {formatDiaMes(c.fim)}
                          </div>
                          <div className="text-muted">{diasEntre(c.inicio, c.fim) + 1} dias</div>
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
