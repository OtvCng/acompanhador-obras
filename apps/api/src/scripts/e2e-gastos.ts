/**
 * E2E das rotas de gastos contra uma API rodando. NÃO rode no banco de dev do dia a dia: cria usuários e uma obra.
 * Use o stack de teste isolado (docs/deploy/2026-11-09-coolify.md §3.1):
 *   E2E_API=http://127.0.0.1:8080/api E2E_EMAIL=diretor@teste.local E2E_SENHA=... pnpm exec tsx src/scripts/e2e-gastos.ts
 * Sai com código 1 se alguma checagem falhar. No fim apaga a obra (os gastos vão junto) e desativa os usuários criados.
 */
import { gerarObra, MODELOS, type Gasto, type Obra, type ResultadoImportacao } from '@obras/shared';

const API = process.env.E2E_API ?? 'http://127.0.0.1:8080/api';
const EMAIL = process.env.E2E_EMAIL ?? 'diretor@teste.local';
const SENHA = process.env.E2E_SENHA ?? '';
if (!SENHA) { console.error('Defina E2E_SENHA (senha do diretor).'); process.exit(2); }

let falhas = 0;
function ok(cond: unknown, msg: string) {
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
}

class Sessao {
  cookie = '';
  async req<T = unknown>(metodo: string, rota: string, corpo?: unknown): Promise<{ status: number; dados: T }> {
    const r = await fetch(API + rota, {
      method: metodo,
      headers: { ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const texto = await r.text();
    return { status: r.status, dados: (texto ? JSON.parse(texto) : null) as T };
  }
  async entrar(email: string, senha: string) {
    const r = await this.req('POST', '/auth/login', { email, senha });
    if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.dados)}`);
  }
}

const sufixo = Date.now().toString(36);
const SENHA_TESTE = `E2e-${sufixo}-senha`;
const dir = new Sessao();
await dir.entrar(EMAIL, SENHA);

async function criarUsuario(perfil: string, nome: string) {
  const email = `e2e-${perfil}-${nome}-${sufixo}@teste.local`;
  const r = await dir.req<{ id: string }>('POST', '/usuarios', { nome: `E2E ${nome}`, email, perfil, senha: SENHA_TESTE });
  if (r.status !== 201) throw new Error(`criar usuário: ${r.status} ${JSON.stringify(r.dados)}`);
  const s = new Sessao();
  await s.entrar(email, SENHA_TESTE);
  return { id: r.dados.id, s };
}
const eng = await criarUsuario('engenheiro', 'eng');
const outroEng = await criarUsuario('engenheiro', 'outro');
const enc = await criarUsuario('encarregado', 'enc');

// Obra nova do engenheiro, com o encarregado.
const base = gerarObra({
  nome: `Obra E2E gastos ${sufixo}`, tipo: 'casa_terrea', endereco: 'Rua Teste E2E, 1', cidade: 'Brusque', areaM2: 120,
  dataInicio: '2026-01-05', orcamentoTotal: 400_000, engenheiroId: eng.id, encarregadoId: enc.id,
}, `obra-e2e-${sufixo}`, MODELOS.casa_terrea);
const criada = await eng.s.req<Obra>('POST', '/obras', base);
ok(criada.status === 201, `engenheiro cria a obra (${criada.status})`);
const obra = criada.dados;
ok(Array.isArray(obra.gastos) && obra.gastos.length === 0, 'obra nova vem com gastos: []');
const [e1, e2] = obra.etapas;
const at1 = e1.atividades[0];
const at2 = e2.atividades[0];

try {
  // --- Encarregado vê R$ (flag desligada) e lança
  const vistaEnc = await enc.s.req<Obra[]>('GET', '/obras');
  ok(vistaEnc.dados.length === 1 && vistaEnc.dados[0].orcamentoTotal === 400_000, 'encarregado vê a obra com R$ reais (OCULTAR_VALORES_ENCARREGADO=false)');

  const idLocal = `gasto-${crypto.randomUUID()}`;
  const novo = await enc.s.req<Gasto>('POST', `/obras/${obra.id}/gastos`, {
    id: idLocal, data: '2026-02-10', etapaCodigo: e1.codigo, atividadeId: at1.id, categoria: 'material', valor: 1234.567,
    descricao: '  Cimento  ', fornecedor: 'Depósito Teste', documento: '',
  });
  ok(novo.status === 201 && novo.dados.id === idLocal, `encarregado lança gasto com id do navegador (${novo.status})`);
  ok(novo.dados.valor === 1234.57 && novo.dados.descricao === 'Cimento' && novo.dados.documento === undefined && novo.dados.autorId === enc.id,
    'valor arredondado a 2 casas, texto aparado, documento vazio = ausente, autor = quem lançou');
  ok((await enc.s.req('POST', `/obras/${obra.id}/gastos`, { ...novo.dados })).status === 409, 'mesmo id de novo = 409');

  const ruins: [string, unknown][] = [
    ['etapa inexistente', { data: '2026-02-10', etapaCodigo: 99, categoria: 'material', valor: 10, descricao: 'x' }],
    ['atividade de outra etapa', { data: '2026-02-10', etapaCodigo: e1.codigo, atividadeId: at2.id, categoria: 'material', valor: 10, descricao: 'x' }],
    ['valor zero', { data: '2026-02-10', etapaCodigo: e1.codigo, categoria: 'material', valor: 0, descricao: 'x' }],
    ['data inexistente', { data: '2026-02-30', etapaCodigo: e1.codigo, categoria: 'material', valor: 10, descricao: 'x' }],
    ['categoria inválida', { data: '2026-02-10', etapaCodigo: e1.codigo, categoria: 'comida', valor: 10, descricao: 'x' }],
    ['descrição vazia', { data: '2026-02-10', etapaCodigo: e1.codigo, categoria: 'material', valor: 10, descricao: '  ' }],
  ];
  for (const [nome, corpo] of ruins) ok((await enc.s.req('POST', `/obras/${obra.id}/gastos`, corpo)).status === 400, `400: ${nome}`);

  // --- Aparece no GET da obra e na lista
  const lista = await eng.s.req<Gasto[]>('GET', `/obras/${obra.id}/gastos`);
  ok(lista.status === 200 && lista.dados.length === 1, 'GET /obras/:id/gastos lista o gasto');
  const obraGet = await dir.req<Obra>('GET', `/obras/${obra.id}`);
  ok(obraGet.dados.gastos.length === 1 && obraGet.dados.gastos[0].id === idLocal, 'GET /obras/:id devolve gastos');

  // --- PATCH
  let p = await eng.s.req<Gasto>('PATCH', `/gastos/${idLocal}`, { valor: 2000, fornecedor: null });
  ok(p.status === 200 && p.dados.valor === 2000 && p.dados.fornecedor === undefined && p.dados.atividadeId === at1.id, 'PATCH valor e limpa fornecedor (null)');
  p = await eng.s.req<Gasto>('PATCH', `/gastos/${idLocal}`, { etapaCodigo: e2.codigo });
  ok(p.status === 200 && p.dados.etapaCodigo === e2.codigo && p.dados.atividadeId === undefined, 'trocar etapa sem atividade vira "Geral da etapa"');
  ok((await eng.s.req('PATCH', `/gastos/${idLocal}`, { atividadeId: at1.id })).status === 400, 'PATCH com atividade de outra etapa = 400');

  // --- Quem não enxerga a obra
  ok((await outroEng.s.req('GET', `/obras/${obra.id}/gastos`)).status === 404, 'outro engenheiro: GET gastos 404');
  ok((await outroEng.s.req('POST', `/obras/${obra.id}/gastos`, { data: '2026-02-10', etapaCodigo: e1.codigo, categoria: 'material', valor: 1, descricao: 'x' })).status === 404, 'outro engenheiro: POST 404');
  ok((await outroEng.s.req('PATCH', `/gastos/${idLocal}`, { valor: 1 })).status === 404, 'outro engenheiro: PATCH 404');
  ok((await outroEng.s.req('DELETE', `/gastos/${idLocal}`)).status === 404, 'outro engenheiro: DELETE 404');
  ok((await new Sessao().req('GET', `/obras/${obra.id}/gastos`)).status === 401, 'sem login: 401');

  // --- Importação
  const imp = await enc.s.req<ResultadoImportacao>('POST', `/obras/${obra.id}/gastos/importar`, { linhas: [
    { Data: '15/03/2026', Etapa: String(e1.codigo), Atividade: at1.codigo, Categoria: 'Mão de obra', 'Valor (R$)': '1.500,00', 'Descrição': 'Diárias' },
    { data: '2026-03-16', etapa: e2.nome, atividade: '', categoria: 'terceiros', valor: '800', descricao: 'Sondagem' },
    { data: '31/02/2026', etapa: '99', atividade: '', categoria: 'xx', valor: 'abc', descricao: '' },
    { data: '', etapa: '', atividade: '', categoria: '', valor: '', descricao: '' },
  ] });
  ok(imp.status === 201 && imp.dados.gravadas === 2 && !!imp.dados.importacaoId, `importar grava só as 2 válidas (${imp.status})`);
  ok(imp.dados.erros.length === 1 && imp.dados.erros[0].linha === 4 && imp.dados.erros[0].erros.length >= 4, 'erro com nº da linha da planilha e motivos');
  const aposImp = await enc.s.req<Gasto[]>('GET', `/obras/${obra.id}/gastos`);
  const lote = aposImp.dados.filter((g) => g.importacaoId === imp.dados.importacaoId);
  ok(lote.length === 2 && lote.some((g) => g.valor === 1500 && g.categoria === 'mao_de_obra' && g.atividadeId === at1.id), 'lote gravado com valores BR convertidos');
  const soErros = await enc.s.req<ResultadoImportacao>('POST', `/obras/${obra.id}/gastos/importar`, { linhas: [{ data: 'x' }] });
  ok(soErros.status === 200 && soErros.dados.gravadas === 0 && soErros.dados.importacaoId === null, 'importação sem linha válida não grava nada');
  ok((await outroEng.s.req('DELETE', `/importacoes/${imp.dados.importacaoId}`)).status === 404, 'outro engenheiro não desfaz o lote (404)');
  const desf = await enc.s.req<{ removidos: number }>('DELETE', `/importacoes/${imp.dados.importacaoId}`);
  ok(desf.status === 200 && desf.dados.removidos === 2, 'desfazer importação remove o lote inteiro');
  ok((await enc.s.req('DELETE', `/importacoes/${imp.dados.importacaoId}`)).status === 404, 'desfazer de novo = 404');

  // --- PUT da obra não apaga gastos
  const atual = (await eng.s.req<Obra>('GET', `/obras/${obra.id}`)).dados;
  const put = await eng.s.req<Obra>('PUT', `/obras/${obra.id}`, { ...atual, nome: `${atual.nome} (editada)`, gastos: [] });
  ok(put.status === 200 && put.dados.gastos.length === 1, 'PUT da obra preserva os gastos (gastos do corpo são ignorados)');

  // --- DELETE
  ok((await enc.s.req('DELETE', `/gastos/${idLocal}`)).status === 200, 'encarregado exclui gasto');
  ok((await enc.s.req('DELETE', `/gastos/${idLocal}`)).status === 404, 'excluir de novo = 404');

  // --- Cascade ao excluir a obra
  const g2 = await eng.s.req<Gasto>('POST', `/obras/${obra.id}/gastos`, { data: '2026-04-01', etapaCodigo: e1.codigo, categoria: 'outros', valor: 5, descricao: 'cascade' });
  ok(g2.status === 201, 'gasto para testar cascade');
  ok((await eng.s.req('DELETE', `/obras/${obra.id}`)).status === 403, 'engenheiro não exclui obra (403)');
  ok((await dir.req('DELETE', `/obras/${obra.id}`)).status === 200, 'diretor exclui a obra');
  ok((await dir.req('PATCH', `/gastos/${g2.dados.id}`, { valor: 1 })).status === 404, 'gastos da obra excluída somem (cascade)');
} finally {
  await dir.req('DELETE', `/obras/${obra.id}`);
  for (const u of [eng, outroEng, enc]) await dir.req('PATCH', `/usuarios/${u.id}`, { ativo: false });
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nE2E gastos: tudo ok');
process.exit(falhas ? 1 : 0);
