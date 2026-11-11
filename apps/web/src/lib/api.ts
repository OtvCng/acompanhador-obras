/** Cliente HTTP da API (/api, mesma origem; em dev o Vite faz proxy para a porta 3333). */

export class ErroApi extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', rota: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${rota}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const texto = await r.text();
  let dados: unknown = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { /* resposta não JSON */ }
  if (!r.ok) {
    const msg = (dados as { erro?: string } | null)?.erro ?? `Erro ${r.status} no servidor.`;
    throw new ErroApi(r.status, msg);
  }
  return dados as T;
}

export const mensagemErro = (e: unknown) => (e instanceof Error ? e.message : 'Erro desconhecido.');

/** Data de hoje no fuso local, ISO AAAA-MM-DD. */
export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
