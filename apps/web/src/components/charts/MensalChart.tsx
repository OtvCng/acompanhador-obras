import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PontoCurvaS } from '@obras/shared';
import { formatBRL, formatBRLCompacto, formatMesAno } from '@/lib/format';

export interface PontoMensal {
  mes: string; // "2026-11"
  previsto: number; // R$ no mês
  realizado: number | null; // R$ agregado no mês (null = mês futuro)
}

/** Agrega a Curva S (acumulada, semanal) em valores mensais (não acumulados). */
export function curvaParaMensal(pontos: PontoCurvaS[]): PontoMensal[] {
  const ultimoDoMes = new Map<string, PontoCurvaS>();
  for (const p of pontos) ultimoDoMes.set(p.data.slice(0, 7), p);
  const meses = [...ultimoDoMes.keys()].sort();
  let prevAnt = 0;
  let realAnt = 0;
  return meses.map((mes) => {
    const p = ultimoDoMes.get(mes)!;
    const previsto = p.previstoValor - prevAnt;
    prevAnt = p.previstoValor;
    let realizado: number | null = null;
    if (p.realizadoValor != null) {
      realizado = p.realizadoValor - realAnt;
      realAnt = p.realizadoValor;
    }
    return { mes, previsto, realizado };
  });
}

/** Barras previsto x realizado (valor agregado) por mês. */
export function MensalChart({ dados, altura = 280 }: { dados: PontoMensal[]; altura?: number }) {
  if (dados.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted" style={{ height: altura }}>
        Sem dados mensais: a obra ainda não tem baseline.
      </div>
    );
  }
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 16 }} barGap={2}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mes" tickFormatter={(m: string) => formatMesAno(`${m}-01`)} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
          <YAxis tickFormatter={(v: number) => formatBRLCompacto(v)} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={72} />
          <Tooltip
            formatter={(v: number, nome: string) => [formatBRL(v), nome === 'previsto' ? 'Previsto (baseline)' : 'Realizado (valor agregado)']}
            labelFormatter={(m: string) => formatMesAno(`${m}-01`)}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e5e7eb' }}
            cursor={{ fill: '#f3f4f6' }}
          />
          <Legend formatter={(v: string) => (v === 'previsto' ? 'Previsto (baseline)' : 'Realizado (valor agregado)')} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="previsto" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="realizado" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
