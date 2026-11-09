/** Configuração lida do ambiente (.env em dev, variáveis do Coolify em produção). */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://obras:obras@127.0.0.1:5433/obras',
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? '127.0.0.1',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  producao: process.env.NODE_ENV === 'production',
};

/** "Hoje" do servidor no fuso de Brusque (ISO YYYY-MM-DD). Apontamentos e baselines usam esta data. */
export function hojeServidor(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
