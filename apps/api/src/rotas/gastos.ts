/**
 * Gastos reais (financeiro orçado x realizado, plano docs/planejamento/2026-11-10-15-37-financeiro-orcado-x-realizado.md).
 * Quem enxerga a obra pode listar, lançar, editar, excluir e importar (sem restrição por perfil, decisão do Otavio).
 * Se OCULTAR_VALORES_ENCARREGADO for religada, o encarregado perde o acesso a estas rotas (403).
 */
import type { FastifyInstance } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { validarLinhasGasto, type Gasto, type Obra } from '@obras/shared';
import { db, schema as s } from '../db';
import { ErroHttp, exigirUsuario, type UsuarioSessao } from '../auth/sessao';
import { carregarObra, gastoDaLinha, inserirGastos } from '../repo/obras';
import { obraVisivel, ocultaValores } from './obras';
import * as v from '../validacao';

function exigirAcessoGastos(u: UsuarioSessao) {
  if (ocultaValores(u)) throw new ErroHttp(403, 'Seu perfil não tem acesso aos gastos.');
}

/** Etapa precisa existir na obra; atividade (se houver) precisa ser dessa etapa. */
function conferirEtapaAtividade(obra: Obra, etapaCodigo: number, atividadeId: string | null | undefined) {
  const etapa = obra.etapas.find((e) => e.codigo === etapaCodigo);
  if (!etapa) throw new ErroHttp(400, `A etapa ${etapaCodigo} não existe nesta obra.`);
  if (atividadeId && !etapa.atividades.some((a) => a.id === atividadeId)) {
    throw new ErroHttp(400, `A atividade escolhida não pertence à etapa ${etapaCodigo}.`);
  }
}

/** Carrega o gasto e confere se o usuário enxerga a obra dele (404 nos dois casos, sem revelar nada). */
async function gastoVisivel(u: UsuarioSessao, id: string) {
  const [linha] = await db.select().from(s.gastos).where(eq(s.gastos.id, id));
  if (!linha) throw new ErroHttp(404, 'Gasto não encontrado.');
  try { await obraVisivel(u, linha.obraId); } catch { throw new ErroHttp(404, 'Gasto não encontrado.'); }
  return linha;
}

export async function rotasGastos(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/api/obras/:id/gastos', async (req) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    await obraVisivel(u, req.params.id);
    const linhas = await db.select().from(s.gastos).where(eq(s.gastos.obraId, req.params.id)).orderBy(asc(s.gastos.data), asc(s.gastos.criadoEm), asc(s.gastos.id));
    return linhas.map(gastoDaLinha);
  });

  app.post<{ Params: { id: string } }>('/api/obras/:id/gastos', async (req, reply) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    await obraVisivel(u, req.params.id);
    const d = v.novoGasto.parse(req.body);
    if (d.obraId && d.obraId !== req.params.id) throw new ErroHttp(400, 'Identificador da obra não confere.');
    const obra = (await carregarObra(req.params.id))!;
    conferirEtapaAtividade(obra, d.etapaCodigo, d.atividadeId);
    const id = d.id ?? `gasto-${randomUUID()}`;
    const [existe] = await db.select({ id: s.gastos.id }).from(s.gastos).where(eq(s.gastos.id, id));
    if (existe) throw new ErroHttp(409, 'Este gasto já foi gravado.');
    const g: Gasto = {
      id, obraId: obra.id, data: d.data, etapaCodigo: d.etapaCodigo, categoria: d.categoria, valor: d.valor, descricao: d.descricao,
      autorId: u.id, criadoEm: new Date().toISOString(),
      ...(d.atividadeId ? { atividadeId: d.atividadeId } : {}),
      ...(d.fornecedor ? { fornecedor: d.fornecedor } : {}),
      ...(d.documento ? { documento: d.documento } : {}),
    };
    await inserirGastos(db, [g]);
    reply.code(201);
    const [linha] = await db.select().from(s.gastos).where(eq(s.gastos.id, id));
    return gastoDaLinha(linha);
  });

  app.patch<{ Params: { id: string } }>('/api/gastos/:id', async (req) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    const atual = await gastoVisivel(u, req.params.id);
    const d = v.edicaoGasto.parse(req.body ?? {});
    const etapaCodigo = d.etapaCodigo ?? atual.etapaCodigo;
    // Trocou a etapa sem dizer a atividade: a atividade antiga (de outra etapa) é descartada.
    const atividadeId = d.atividadeId !== undefined ? d.atividadeId : (d.etapaCodigo !== undefined && d.etapaCodigo !== atual.etapaCodigo ? null : atual.atividadeId);
    const obra = (await carregarObra(atual.obraId))!;
    conferirEtapaAtividade(obra, etapaCodigo, atividadeId);
    await db.update(s.gastos).set({
      ...(d.data !== undefined ? { data: d.data } : {}),
      etapaCodigo,
      atividadeId: atividadeId ?? null,
      ...(d.categoria !== undefined ? { categoria: d.categoria } : {}),
      ...(d.valor !== undefined ? { valor: d.valor } : {}),
      ...(d.descricao !== undefined ? { descricao: d.descricao } : {}),
      ...(d.fornecedor !== undefined ? { fornecedor: d.fornecedor } : {}),
      ...(d.documento !== undefined ? { documento: d.documento } : {}),
    }).where(eq(s.gastos.id, atual.id));
    const [linha] = await db.select().from(s.gastos).where(eq(s.gastos.id, atual.id));
    return gastoDaLinha(linha);
  });

  app.delete<{ Params: { id: string } }>('/api/gastos/:id', async (req) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    const atual = await gastoVisivel(u, req.params.id);
    await db.delete(s.gastos).where(eq(s.gastos.id, atual.id));
    return { ok: true };
  });

  /** Revalida no servidor e grava só as linhas válidas, tudo numa transação, com um importacaoId. */
  app.post<{ Params: { id: string } }>('/api/obras/:id/gastos/importar', async (req, reply) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    await obraVisivel(u, req.params.id);
    const { linhas } = v.importarGastos.parse(req.body);
    const obra = (await carregarObra(req.params.id))!;
    const resultado = validarLinhasGasto(obra, linhas);
    const validas = resultado.filter((l) => l.dados && l.erros.length === 0);
    const erros = resultado.filter((l) => l.erros.length > 0);
    if (validas.length === 0) return { gravadas: 0, importacaoId: null, erros };
    const importacaoId = `imp-${randomUUID()}`;
    const agora = new Date().toISOString();
    const gastos: Gasto[] = validas.map((l) => ({
      ...l.dados!, exemplo: undefined, id: `gasto-${randomUUID()}`, obraId: obra.id, autorId: u.id, criadoEm: agora, importacaoId,
    }));
    await db.transaction((tx) => inserirGastos(tx, gastos));
    reply.code(201);
    return { gravadas: gastos.length, importacaoId, erros };
  });

  /** Desfaz um lote importado inteiro. */
  app.delete<{ Params: { importacaoId: string } }>('/api/importacoes/:importacaoId', async (req) => {
    const u = exigirUsuario(req);
    exigirAcessoGastos(u);
    const [um] = await db.select({ obraId: s.gastos.obraId }).from(s.gastos).where(eq(s.gastos.importacaoId, req.params.importacaoId)).limit(1);
    if (!um) throw new ErroHttp(404, 'Importação não encontrada.');
    try { await obraVisivel(u, um.obraId); } catch { throw new ErroHttp(404, 'Importação não encontrada.'); }
    const apagados = await db.delete(s.gastos)
      .where(and(eq(s.gastos.importacaoId, req.params.importacaoId), eq(s.gastos.obraId, um.obraId)))
      .returning({ id: s.gastos.id });
    return { ok: true, removidos: apagados.length };
  });
}
