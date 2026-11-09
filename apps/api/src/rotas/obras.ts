/** Obras: listar, criar, gravar, congelar baseline e lançar apontamento. Permissões por perfil (Q5). */
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { aplicarApontamento, congelarBaseline, ocultarValores, type Obra } from '@obras/shared';
import { db, schema as s } from '../db';
import { hojeServidor } from '../env';
import { ErroHttp, exigirPerfil, exigirUsuario, type UsuarioSessao } from '../auth/sessao';
import { carregarObra, carregarObras, gravarApontamento, gravarObra, inserirBaseline, travarObra } from '../repo/obras';
import { recriarExemplos } from '../repo/exemplos';
import * as v from '../validacao';

type LinhaObra = { engenheiroId: string; encarregadoId: string };

const podeVer = (u: UsuarioSessao, o: LinhaObra) =>
  u.perfil === 'diretor' || (u.perfil === 'engenheiro' ? o.engenheiroId === u.id : o.encarregadoId === u.id);
const podeEditar = (u: UsuarioSessao, o: LinhaObra) => u.perfil === 'diretor' || (u.perfil === 'engenheiro' && o.engenheiroId === u.id);

/** Encarregado nunca recebe R$ (valores viram pesos; ver ocultarValores). */
const paraUsuario = (u: UsuarioSessao, o: Obra) => (u.perfil === 'encarregado' ? ocultarValores(o) : o);

async function obraVisivel(u: UsuarioSessao, id: string) {
  const [linha] = await db.select({ engenheiroId: s.obras.engenheiroId, encarregadoId: s.obras.encarregadoId }).from(s.obras).where(eq(s.obras.id, id));
  if (!linha || !podeVer(u, linha)) throw new ErroHttp(404, 'Obra não encontrada.');
  return linha;
}

async function conferirResponsaveis(engenheiroId: string, encarregadoId: string) {
  const us = await db.select({ id: s.usuarios.id, ativo: s.usuarios.ativo }).from(s.usuarios).where(inArray(s.usuarios.id, [engenheiroId, encarregadoId]));
  for (const id of [engenheiroId, encarregadoId]) {
    if (!us.some((x) => x.id === id)) throw new ErroHttp(400, 'Engenheiro ou encarregado inexistente.');
  }
}

export async function rotasObras(app: FastifyInstance) {
  app.get('/api/obras', async (req) => {
    const u = exigirUsuario(req);
    let ids: string[] | undefined;
    if (u.perfil !== 'diretor') {
      const campo = u.perfil === 'engenheiro' ? s.obras.engenheiroId : s.obras.encarregadoId;
      ids = (await db.select({ id: s.obras.id }).from(s.obras).where(eq(campo, u.id))).map((x) => x.id);
    }
    return (await carregarObras(ids)).map((o) => paraUsuario(u, o));
  });

  app.get<{ Params: { id: string } }>('/api/obras/:id', async (req) => {
    const u = exigirUsuario(req);
    await obraVisivel(u, req.params.id);
    return paraUsuario(u, (await carregarObra(req.params.id))!);
  });

  /** Grava a obra gerada pelo wizard. Aceita no máximo a baseline v1, com autor e data do servidor. */
  app.post('/api/obras', async (req, reply) => {
    const u = exigirPerfil(req, 'diretor', 'engenheiro');
    const obra = v.obra.parse(req.body) as Obra;
    if (obra.baselines.length > 1) throw new ErroHttp(400, 'Obra nova só pode vir com a baseline v1.');
    await conferirResponsaveis(obra.engenheiroId, obra.encarregadoId);
    const [existe] = await db.select({ id: s.obras.id }).from(s.obras).where(eq(s.obras.id, obra.id));
    if (existe) throw new ErroHttp(409, 'Já existe uma obra com este identificador.');
    const hoje = hojeServidor();
    const nova: Obra = {
      ...obra,
      apontamentos: [],
      baselines: obra.baselines.map((b) => ({ ...b, versao: 1, autorId: u.id, congeladaEm: hoje, justificativa: undefined })),
    };
    for (const e of nova.etapas) for (const a of e.atividades) for (const i of a.itens) {
      i.percentual = 0; delete i.inicioReal; delete i.fimReal;
    }
    await db.transaction((tx) => gravarObra(tx, nova, { nova: true, comHistorico: true }));
    reply.code(201);
    return carregarObra(nova.id);
  });

  /**
   * Grava estrutura, datas e valores. Ignora baselines e apontamentos do corpo e preserva o avanço real
   * (percentual, início/fim real) que está no banco: avanço só muda por apontamento.
   */
  app.put<{ Params: { id: string } }>('/api/obras/:id', async (req) => {
    const u = exigirPerfil(req, 'diretor', 'engenheiro');
    const linha = await obraVisivel(u, req.params.id);
    if (!podeEditar(u, linha)) throw new ErroHttp(403, 'Só o engenheiro responsável ou o diretor editam esta obra.');
    const corpo = v.obra.parse(req.body) as Obra;
    if (corpo.id !== req.params.id) throw new ErroHttp(400, 'Identificador da obra não confere.');
    await conferirResponsaveis(corpo.engenheiroId, corpo.encarregadoId);

    await db.transaction(async (tx) => {
      const travada = await travarObra(tx, corpo.id);
      if (corpo.revisao !== undefined && travada.revisao !== corpo.revisao) {
        throw new ErroHttp(409, 'Outra pessoa salvou esta obra antes. Os dados foram recarregados; refaça a alteração.');
      }
      const atual = (await carregarObra(corpo.id, tx))!;
      const avanco = new Map(atual.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)).map((i) => [i.id, i]));
      for (const e of corpo.etapas) for (const a of e.atividades) for (const i of a.itens) {
        const r = avanco.get(i.id);
        i.percentual = r?.percentual ?? 0;
        if (r?.inicioReal) i.inicioReal = r.inicioReal; else delete i.inicioReal;
        if (r?.fimReal) i.fimReal = r.fimReal; else delete i.fimReal;
      }
      await gravarObra(tx, { ...corpo, revisao: travada.revisao }, { nova: false });
    });
    return carregarObra(corpo.id);
  });

  app.post<{ Params: { id: string } }>('/api/obras/:id/baselines', async (req) => {
    const u = exigirPerfil(req, 'diretor', 'engenheiro');
    const linha = await obraVisivel(u, req.params.id);
    if (!podeEditar(u, linha)) throw new ErroHttp(403, 'Só o engenheiro responsável ou o diretor replanejam esta obra.');
    const { justificativa } = v.novaBaseline.parse(req.body ?? {});
    await db.transaction(async (tx) => {
      const travada = await travarObra(tx, req.params.id);
      const obra = (await carregarObra(req.params.id, tx))!;
      let nova: Obra;
      try {
        nova = congelarBaseline(obra, u.id, hojeServidor(), justificativa || undefined);
      } catch (e) {
        throw new ErroHttp(400, e instanceof Error ? e.message : 'Não foi possível congelar a baseline.');
      }
      await inserirBaseline(tx, obra.id, nova.baselines.at(-1)!);
      await tx.update(s.obras).set({ status: nova.status, revisao: travada.revisao + 1, atualizadoEm: new Date() }).where(eq(s.obras.id, obra.id));
    });
    return carregarObra(req.params.id);
  });

  app.post<{ Params: { id: string } }>('/api/obras/:id/apontamentos', async (req, reply) => {
    const u = exigirUsuario(req);
    await obraVisivel(u, req.params.id);
    const a = v.apontamento.parse(req.body);
    await db.transaction(async (tx) => {
      const travada = await travarObra(tx, req.params.id);
      const obra = (await carregarObra(req.params.id, tx))!;
      const r = aplicarApontamento({ ...obra, revisao: travada.revisao }, a, u.id, hojeServidor(), `ap-${randomUUID()}`);
      if (!r) throw new ErroHttp(400, 'Item não pertence a esta obra.');
      await gravarApontamento(tx, { ...r.obra, revisao: travada.revisao }, r.apontamento);
    });
    reply.code(201);
    return paraUsuario(u, (await carregarObra(req.params.id))!);
  });

  /** Apaga só as obras de exemplo e recria as 6 de demonstração. */
  app.post('/api/exemplos', async (req) => {
    exigirPerfil(req, 'diretor');
    const n = await recriarExemplos();
    return { ok: true, obras: n };
  });

  /** Exclusão definitiva (com histórico): só o diretor. */
  app.delete<{ Params: { id: string } }>('/api/obras/:id', async (req) => {
    const u = exigirPerfil(req, 'diretor');
    await obraVisivel(u, req.params.id);
    await db.delete(s.obras).where(eq(s.obras.id, req.params.id));
    return { ok: true };
  });
}
