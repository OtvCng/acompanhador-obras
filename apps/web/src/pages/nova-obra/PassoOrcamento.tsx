import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { ETAPAS_CAIXA, etapasForaDaFaixa, type Obra } from '@obras/shared';
import { Aviso, Botao, Card, EstadoVazio, Selo, SeloEstimativa, cn } from '@/components/campo/ui';
import EntradaNumero from '@/components/campo/EntradaNumero';
import { formatarBRL, formatarPct, plural } from '@/components/campo/formatos';

const r2 = (v: number) => Math.round(v * 100) / 100;

export default function PassoOrcamento({
  obra,
  erroPrevia,
  temEdicao,
  aoMudarValor,
  aoRestaurar,
}: {
  obra: Obra | null;
  erroPrevia: string | null;
  temEdicao: boolean;
  aoMudarValor: (codigo: number, valor: number) => void;
  aoRestaurar: () => void;
}) {
  const fora = useMemo(() => {
    if (!obra) return new Map<number, { faixaMin: number; faixaMax: number; percentual: number }>();
    try {
      return new Map(etapasForaDaFaixa(obra).map((f) => [f.codigo, f]));
    } catch {
      return new Map();
    }
  }, [obra]);

  if (!obra) {
    return (
      <EstadoVazio titulo="Não foi possível gerar a prévia do orçamento">
        {erroPrevia ?? 'O gerador de obras ainda não está disponível.'} Volte mais tarde ou siga com os parâmetros preenchidos quando o motor estiver no ar.
      </EstadoVazio>
    );
  }

  const total = obra.orcamentoTotal;
  const soma = r2(obra.etapas.reduce((s, e) => s + e.valorOrcado, 0));
  const diferenca = r2(total - soma);
  const confere = Math.abs(diferenca) < 0.01;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Distribuição do orçamento por etapa</h2>
          <p className="text-sm text-muted">
            Os valores partem do ponto médio das faixas de referência da Caixa e são <strong>estimativas</strong>. Ajuste o valor ou o percentual de cada etapa; o valor é
            redistribuído proporcionalmente entre as atividades da etapa.
          </p>
        </div>
        {temEdicao && (
          <Botao variante="secundario" onClick={aoRestaurar}>
            <RotateCcw className="size-4" aria-hidden />
            Voltar à estimativa
          </Botao>
        )}
      </div>

      {fora.size > 0 && (
        <Aviso titulo={`${plural(fora.size, 'etapa', 'etapas')} fora da faixa de referência da Caixa`}>
          Não impede salvar, mas confira se o valor faz sentido para esta obra.
        </Aviso>
      )}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_8rem_7rem_10rem] gap-3 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid">
          <span>Etapa</span>
          <span className="text-right">Faixa Caixa</span>
          <span className="text-right">% do total</span>
          <span className="text-right">Valor (R$)</span>
        </div>
        <ul className="divide-y divide-border">
          {obra.etapas.map((e) => {
            const ref = ETAPAS_CAIXA.find((x) => x.codigo === e.codigo);
            const f = fora.get(e.codigo);
            const faixa = ref && ref.faixaMin !== null && ref.faixaMax !== null ? `${formatarPct(ref.faixaMin)} a ${formatarPct(ref.faixaMax)}` : 'sem referência';
            return (
              <li key={e.codigo} className={cn('grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[1fr_8rem_7rem_10rem] md:items-center', f && 'bg-amber-50/60')}>
                <div className="col-span-2 md:col-span-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs tabular-nums text-muted">{e.codigo}.</span>
                    <span className="font-medium text-gray-900">{e.nome}</span>
                    {e.valorEstimado ? <SeloEstimativa /> : <Selo tom="azul">ajustado</Selo>}
                  </div>
                  {f && (
                    <div className="mt-1 text-xs text-saude-amarelo">
                      {formatarPct(f.percentual)} está fora da faixa Caixa ({formatarPct(f.faixaMin)} a {formatarPct(f.faixaMax)}).
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-xs text-muted md:col-span-1 md:text-right md:text-sm">
                  <span className="md:hidden">Faixa Caixa: </span>
                  {faixa}
                </div>
                <EntradaNumero
                  rotulo={`Percentual da etapa ${e.nome}`}
                  valor={r2(pct(e.valorOrcado))}
                  casas={2}
                  min={0}
                  max={100}
                  sufixo="%"
                  aoConfirmar={(p) => aoMudarValor(e.codigo, r2((p / 100) * total))}
                />
                <EntradaNumero rotulo={`Valor da etapa ${e.nome}`} valor={e.valorOrcado} casas={2} min={0} aoConfirmar={(v) => aoMudarValor(e.codigo, r2(v))} />
              </li>
            );
          })}
        </ul>
        <div className={cn('grid grid-cols-2 gap-3 border-t border-border px-4 py-3 text-sm md:grid-cols-[1fr_8rem_7rem_10rem]', confere ? 'bg-gray-50' : 'bg-red-50')}>
          <div className="font-medium md:col-span-2">Soma das etapas</div>
          <div className="hidden text-right tabular-nums md:block">{formatarPct(pct(soma))}</div>
          <div className="text-right font-semibold tabular-nums">{formatarBRL(soma)}</div>
        </div>
      </Card>

      {confere ? (
        <Aviso tom="azul" titulo="Soma conferida">
          As etapas somam exatamente o orçamento total de {formatarBRL(total)}.
        </Aviso>
      ) : (
        <Aviso tom="vermelho" titulo={diferenca > 0 ? `Faltam ${formatarBRL(diferenca)} para fechar o orçamento` : `As etapas passam ${formatarBRL(-diferenca)} do orçamento`}>
          A soma das etapas ({formatarBRL(soma)}) precisa ser igual ao orçamento total ({formatarBRL(total)}) para continuar.
        </Aviso>
      )}
    </div>
  );
}
