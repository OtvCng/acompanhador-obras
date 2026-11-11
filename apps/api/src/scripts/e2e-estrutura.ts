/**
 * E2E das Levas 2 e 3 (estrutura por andar) contra uma API rodando.
 * Cria UMA obra de teste (prédio 3-6 com baseline v1), mexe só nela e apaga no fim. Não toca em outras obras.
 *   E2E_API=http://127.0.0.1:3333/api pnpm exec tsx --env-file-if-exists=.env src/scripts/e2e-estrutura.ts
 * Login: E2E_EMAIL + E2E_SENHA (diretor). Sem senha, abre uma sessão temporária direto no banco para o primeiro
 * diretor ativo (precisa do DATABASE_URL do .env) e apaga essa sessão no fim.
 * Sai com código 1 se alguma checagem falhar.
 */
import { and, eq } from 'drizzle-orm';
import {
  adicionarPavimento, congelarBaseline, dividirPorAndar, gerarObra, juntarEmObraToda, locaisDeAndar, removerPavimento,
  type Obra,
} from '@obras/shared';
import { db, pool, schema as s } from '../db';
import { hashToken, novoToken } from '../auth/senha';

const API = process.env.E2E_API ?? 'http://127.0.0.1:3333/api';
const EMAIL = process.env.E2E_EMAIL ?? '';
const SENHA = process.env.E2E_SENHA ?? '';

let falhas = 0;
function ok(cond: unknown, msg: string) {
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
}

let cookie = '';
async function req<T = unknown>(metodo: string, rota: string, corpo?: unknown): Promise<{ status: number; dados: T }> {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const texto = await r.text();
  return { status: r.status, dados: (texto ? JSON.parse(texto) : null) as T };
}

// --- Sessão --------------------------------------------------------------------------------------------
let sessaoTemp: string | null = null;
let diretorId: string;
if (EMAIL && SENHA) {
  const r = await req('POST', '/auth/login', { email: EMAIL, senha: SENHA });
  if (r.status !== 200) throw new Error(`login: ${r.status} ${JSON.stringify(r.dados)}`);
  diretorId = (await req<{ usuario: { id: string } }>('GET', '/auth/me')).dados.usuario.id;
} else {
  const [d] = await db.select({ id: s.usuarios.id }).from(s.usuarios)
    .where(and(eq(s.usuarios.perfil, 'diretor'), eq(s.usuarios.ativo, true))).limit(1);
  if (!d) throw new Error('Nenhum diretor ativo no banco.');
  diretorId = d.id;
  const token = novoToken();
  sessaoTemp = hashToken(token);
  await db.insert(s.sessoes).values({ id: sessaoTemp, usuarioId: d.id, expiraEm: new Date(Date.now() + 3600e3) });
  cookie = `sid=${token}`;
}

// --- Obra de teste --------------------------------------------------------------------------------------
const sufixo = Date.now().toString(36);
const obraId = `obra-e2e-estrutura-${sufixo}`;
let n = 0;
const novoId = (p: string) => `${p}-e2e-${sufixo}-${++n}`;
const itensDe = (o: Obra, codigo: string) => o.etapas.flatMap((e) => e.atividades).find((a) => a.codigo === codigo)!;
const cents = (v: number) => Math.round(v * 100);
const canon = (o: Obra) => JSON.stringify(Object.entries(o.baselines[0].itens).sort(([a], [b]) => a.localeCompare(b)));
const mesmaBase = (a: Obra, b: Obra) => canon(a) === canon(b);
const somaBase = (o: Obra) => Object.values(o.baselines[0].itens).reduce((t, e) => t + cents(e.valor), 0);

async function put(o: Obra) {
  return req<Obra & { erro?: string }>('PUT', `/obras/${obraId}`, o);
}

try {
  const gerada = gerarObra({
    nome: `Obra E2E estrutura ${sufixo}`, tipo: 'predio_3_6', endereco: 'Rua Teste E2E, 1', cidade: 'Brusque', areaM2: 600,
    dataInicio: '2026-01-05', orcamentoTotal: 2_000_000, engenheiroId: diretorId, encarregadoId: diretorId,
  }, obraId);
  const criada = await req<Obra>('POST', '/obras', congelarBaseline(gerada, diretorId, '2026-01-02'));
  ok(criada.status === 201, `cria a obra de teste com baseline v1 (${criada.status})`);
  let obra = criada.dados;
  const baseInicial = somaBase(obra);

  // 1) Avanço na atividade "obra toda" antes de dividir (via apontamento).
  const a0 = obra.etapas.flatMap((e) => e.atividades).find((a) => a.itens.length === 1 && obra.locais.find((l) => l.id === a.itens[0].localId)?.tipo === 'obra')!;
  const ap = await req<Obra>('POST', `/obras/${obraId}/apontamentos`, { itemId: a0.itens[0].id, percentualNovo: 40 });
  ok(ap.status === 201, `apontamento de 40% em ${a0.codigo} (${ap.status})`);
  obra = ap.dados;

  // 2) Dividir por andar: o servidor grava o mesmo que a tela calculou.
  const tela1 = dividirPorAndar(obra, a0.id, novoId);
  const r1 = await put(tela1);
  ok(r1.status === 200, `PUT dividir ${a0.codigo} (${r1.status} ${r1.dados?.erro ?? ''})`);
  obra = r1.dados;
  const div = obra.etapas.flatMap((e) => e.atividades).find((a) => a.id === a0.id)!;
  ok(div.itens.length === locaisDeAndar(obra).length, `${a0.codigo} ficou com um item por andar (${div.itens.length})`);
  ok(div.itens.every((i) => i.percentual === 40), 'itens novos copiaram os 40% do original');
  ok(div.itens.every((i) => obra.baselines[0].itens[i.id]), 'todos os itens novos têm entrada na baseline v1');
  ok(mesmaBase(obra, tela1), 'baseline do servidor = baseline da tela');
  ok(somaBase(obra) === baseInicial, 'total da baseline preservado');

  // 3) Adicionar andar.
  const tela2 = adicionarPavimento(obra, { nome: '4º pavimento', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 4 }, novoId);
  const r2 = await put(tela2);
  ok(r2.status === 200, `PUT adicionar andar (${r2.status} ${r2.dados?.erro ?? ''})`);
  obra = r2.dados;
  ok(locaisDeAndar(obra).length === 6, 'obra ficou com 6 andares');
  ok(mesmaBase(obra, tela2), 'baseline do servidor = baseline da tela (andar novo)');
  ok(somaBase(obra) === baseInicial, 'total da baseline preservado');

  // 4) Guarda: andar com avanço não sai (nem pela função, nem forçando o PUT).
  const andarComAvanco = locaisDeAndar(obra)[1];
  let bloqueou = false;
  try { removerPavimento(obra, andarComAvanco.id); } catch { bloqueou = true; }
  ok(bloqueou, 'removerPavimento bloqueia andar com avanço');
  const forcado: Obra = JSON.parse(JSON.stringify(obra));
  forcado.locais = forcado.locais.filter((l) => l.id !== andarComAvanco.id);
  for (const e of forcado.etapas) for (const a of e.atividades) a.itens = a.itens.filter((i) => i.localId !== andarComAvanco.id);
  const r4 = await put(forcado);
  ok(r4.status === 400, `PUT removendo andar com avanço responde 400 (${r4.status} ${r4.dados?.erro ?? ''})`);

  // 5) Remover o andar novo (sem avanço).
  const novoAndar = locaisDeAndar(obra).find((l) => l.nome === '4º pavimento')!;
  const tela5 = removerPavimento(obra, novoAndar.id);
  const r5 = await put(tela5);
  ok(r5.status === 200, `PUT remover andar sem avanço (${r5.status} ${r5.dados?.erro ?? ''})`);
  obra = r5.dados;
  ok(locaisDeAndar(obra).length === 5, 'obra voltou a 5 andares');
  ok(mesmaBase(obra, tela5), 'baseline do servidor = baseline da tela (remoção)');

  // 6) Juntar de volta.
  const tela6 = juntarEmObraToda(obra, a0.id, novoId);
  const r6 = await put(tela6);
  ok(r6.status === 200, `PUT juntar ${a0.codigo} (${r6.status} ${r6.dados?.erro ?? ''})`);
  obra = r6.dados;
  const junto = obra.etapas.flatMap((e) => e.atividades).find((a) => a.id === a0.id)!;
  ok(junto.itens.length === 1 && junto.itens[0].id === a0.itens[0].id, 'voltou a um item, com o id original');
  ok(junto.itens[0].percentual === 40, `% ponderado = 40 (${junto.itens[0].percentual})`);
  ok(mesmaBase(obra, tela6), 'baseline do servidor = baseline da tela (juntar)');
  ok(somaBase(obra) === baseInicial, 'total da baseline preservado');
  ok(JSON.stringify(itensDe(obra, a0.codigo).itens[0].valorOrcado) === JSON.stringify(a0.itens[0].valorOrcado), 'valor da atividade igual ao do começo');
} finally {
  const del = await req('DELETE', `/obras/${obraId}`);
  ok(del.status === 200 || del.status === 404, `apaga a obra de teste (${del.status})`);
  if (sessaoTemp) await db.delete(s.sessoes).where(eq(s.sessoes.id, sessaoTemp));
  await pool.end();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
