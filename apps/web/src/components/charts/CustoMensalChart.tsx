import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatBRLCompacto, formatMesAno } from '@/lib/format';

/** Uma linha de custoMensal() do shared. */
export interface PontoCustoMensal {
  mes: string; // "2026-11"
  gasto: number;
  agregado: number;
  previsto: number;
  gastoAcum: number;
  agregadoAcum: number;
  previstoAcum: number;
}

// Mesma paleta dos gráficos atuais: azul = realizado/valor feito, cinza = previsto. Laranja = gasto real.
export const COR_GASTO = '#ea580c';
export const COR_FEITO = '#2563eb';
export const COR_PREVISTO = '#94a3b8';

const NOMES: Record<string, string> = {
  gasto: 'Gasto no mês',
  agregado: 'Valor feito no mês',
  gastoAcum: 'Gasto acumulado',
  agregadoAcum: 'Valor feito acumulado',
  previstoAcum: 'Previsto acumulado',
};

/**
 * Barras = valores do mês (eixo da esquerda). Linhas = acumulados (eixo da direita).
 * Dois eixos porque o acumulado chega a dezenas de vezes o valor de um mês: num eixo só as barras sumiriam.
 */
/**
 * soGasto: esconde tudo que vem de apontamento/baseline (valor feito e previsto) e, se `orcado` vier,
 * desenha o orçado total como linha de referência no eixo dos acumulados.
 */
export function CustoMensalChart({ dados, altura = 320, soGasto = false, orcado }: { dados: PontoCustoMensal[]; altura?: number; soGasto?: boolean; orcado?: number }) {
  if (dados.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted" style={{ height: altura }}>
        Sem meses para mostrar: a obra ainda não tem gastos lançados.
      </div>
    );
  }
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" tickFormatter={(m: string) => formatMesAno(`${m}-01`)} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} minTickGap={8} />
          <YAxis yAxisId="mes" tickFormatter={(v: number) => formatBRLCompacto(v)} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={60} />
          <YAxis yAxisId="acum" orientation="right" tickFormatter={(v: number) => formatBRLCompacto(v)} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            formatter={(v: number, nome: string) => [formatBRL(v), NOMES[nome] ?? nome]}
            labelFormatter={(m: string) => formatMesAno(`${m}-01`)}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e5e7eb' }}
            cursor={{ fill: '#f3f4f6' }}
          />
          <Legend formatter={(v: string) => NOMES[v] ?? v} wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="mes" dataKey="gasto" fill={COR_GASTO} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          {!soGasto && <Bar yAxisId="mes" dataKey="agregado" fill={COR_FEITO} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />}
          <Line yAxisId="acum" type="monotone" dataKey="gastoAcum" stroke={COR_GASTO} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          {!soGasto && <Line yAxisId="acum" type="monotone" dataKey="agregadoAcum" stroke={COR_FEITO} strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {!soGasto && <Line yAxisId="acum" type="monotone" dataKey="previstoAcum" stroke={COR_PREVISTO} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          {orcado != null && orcado > 0 && (
            <ReferenceLine
              yAxisId="acum"
              y={orcado}
              stroke="#dc2626"
              strokeDasharray="6 4"
              ifOverflow="extendDomain"
              label={{ value: `Orçado ${formatBRLCompacto(orcado)}`, position: 'insideTopLeft', fontSize: 11, fill: '#dc2626' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
