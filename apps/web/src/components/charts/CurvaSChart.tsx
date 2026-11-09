import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ISODate, PontoCurvaS } from '@obras/shared';
import { formatBRL, formatBRLCompacto, formatData, formatDiaMes, formatPctFracao } from '@/lib/format';

export type ModoCurva = 'fisica' | 'financeira';

const COR_PREVISTO = '#94a3b8';
const COR_REALIZADO = '#2563eb';

/** Curva S previsto x realizado com linha "hoje". Física em % ou financeira em R$. */
export function CurvaSChart({ pontos, hoje, modo, altura = 300 }: { pontos: PontoCurvaS[]; hoje: ISODate; modo: ModoCurva; altura?: number }) {
  if (pontos.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted" style={{ height: altura }}>
        Sem curva para exibir: a obra ainda não tem baseline ou cronograma.
      </div>
    );
  }
  const fin = modo === 'financeira';
  const dados = pontos.map((p) => ({
    data: p.data,
    previsto: fin ? p.previstoValor : p.previsto * 100,
    realizado: fin ? p.realizadoValor : p.realizado == null ? null : p.realizado * 100,
  }));
  // A linha "hoje" precisa cair numa data do eixo (categórico): usa o ponto mais próximo <= hoje.
  const xHoje = [...pontos].reverse().find((p) => p.data <= hoje)?.data ?? pontos[0]!.data;
  const fmt = (v: number) => (fin ? formatBRL(v) : formatPctFracao(v / 100));

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 16, right: 16, bottom: 0, left: fin ? 16 : 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="data" tickFormatter={formatDiaMes} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} minTickGap={24} />
          <YAxis
            tickFormatter={(v: number) => (fin ? formatBRLCompacto(v) : `${v.toFixed(0)}%`)}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            domain={fin ? [0, 'auto'] : [0, 100]}
            width={fin ? 72 : 40}
          />
          <Tooltip
            formatter={(v: number, nome: string) => [fmt(v), nome === 'previsto' ? 'Previsto (baseline)' : 'Realizado']}
            labelFormatter={(l: string) => `Semana de ${formatData(l)}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e5e7eb' }}
          />
          <Legend formatter={(v: string) => (v === 'previsto' ? 'Previsto (baseline)' : 'Realizado')} wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
          <ReferenceLine x={xHoje} stroke="#111827" strokeDasharray="4 3" label={{ value: 'hoje', position: 'insideTopRight', fontSize: 11, fill: '#111827' }} />
          <Line type="monotone" dataKey="previsto" stroke={COR_PREVISTO} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="realizado" stroke={COR_REALIZADO} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
