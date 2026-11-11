/** Obras: listar, criar, gravar, congelar baseline e lançar apontamento. Permissões por perfil (Q5). */
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { LIMITE_JUSTIFICATIVA_DU, OCULTAR_VALORES_ENCARREGADO, aplicarApontamento, congelarBaseline, desviosParaJustificar, ocultarValores, type Obra } from '@obras/shared';
import { db, schema as s } from '../db';
import { hojeServidor } from '../env';
import { ErroHttp, exigirPerfil, exigirUsuario, type UsuarioSessao } from '../auth/sessao';
import { carregarObra, carregarObras, gravarApontamento, gravarObra, inserirAlteracao, inserirBaseline, travarObra } from '../repo/obras';
import { recriarExemplos } from '../repo/exemplos';
import * as v from '../validacao';

type LinhaObra = { engenheiroId: string; encarregadoId: string };

const podeVer = (u: UsuarioSessao, o: LinhaObra) =>
  u.perfil === 'diretor' || (u.perfil === 'engenheiro' ? o.engenheiroId === u.id : o.encarregadoId === u.id);
const podeEditar = (u: UsuarioSessao, o: LinhaObra) => u.perfil === 'diretor' || (u.perfil === 'engenheiro' && o.engenheiroId === u.id);

/** Encarregado deixa de receber R$ só se a flag for religada (desligada por decisão do Otavio, 10/11). */
export const ocultaValores = (u: UsuarioSessao) => OCULTAR_VALORES_ENCARREGADO && u.perfil === 'encarregado';
export const paraUsuario = (u: UsuarioSessao, o: Obra) => (ocultaValores(u) ? ocultarValores(o) : o);

/** 404 (não 403) quando o usuário não enxerga a obra: não revela que ela existe. */
export async function obraVisivel(u: UsuarioSessao, id: string) {
  const [linha] = await db.select({ engenheiroId: s.obras.engenheiroId, encarregadoId: s.obras.encarregadoId }).from(s.obras).where(eq(s.obras.id, id));
  if (!linha || !podeVer(u, linha)) throw new ErroHttp(404, 'Obra não encontrada.');
  return linha;
}

/**
 * Confere os responsáveis. O engenheiro precisa ter perfil engenheiro ou diretor (como no wizard): sem isso
 * dava para pôr um encarregado como "engenheiro" da obra via API. O encarregado pode ser qualquer perfil
 * (o wizard deixa o próprio engenheiro tocar a obra quando não há encarregado cadastrado).
 * Responsável novo precisa estar ativo; o que não mudou no PUT não é reconferido (pode ter sido desativado depois).
 */
async function conferirResponsaveis(engenheiroId: string, encarregadoId: string, atual?: LinhaObra) {
  const us = await db.select({ id: s.usuarios.id, perfil: s.usuarios.perfil, ativo: s.usuarios.ativo }).from(s.usuarios).where(inArray(s.usuarios.id, [engenheiroId, encarregadoId]));
  for (const id of [engenheiroId, encarregadoId]) {
    if (!us.some((x) => x.id === id)) throw new ErroHttp(400, 'Engenheiro ou encarregado inexistente.');
  }
  const eng = us.find((x) => x.id === engenheiroId)!;
  const enc = us.find((x) => x.id === encarregadoId)!;
  if (!atual || atual.engenheiroId !== engenheiroId) {
    if (eng.perfil !== 'engenheiro' && eng.perfil !== 'diretor') throw new ErroHttp(400, 'O engenheiro responsável precisa ter perfil de engenheiro ou diretor.');
    if (!eng.ativo) throw new ErroHttp(400, 'O engenheiro escolhido está desativado.');
  }
  if ((!atual || atual.encarregadoId !== encarregadoId) && !enc.ativo) throw new ErroHttp(400, 'O encarregado escolhido está desativado.');
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
      gastos: [],
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
    const { justificativaAlteracao } = v.extraGravarObra.parse(req.body ?? {});
    if (corpo.id !== req.params.id) throw new ErroHttp(400, 'Identificador da obra não confere.');
    // Trocar o engenheiro responsável é decisão do diretor (engenheiro não "passa" a obra adiante pela API).
    if (u.perfil !== 'diretor' && corpo.engenheiroId !== linha.engenheiroId) throw new ErroHttp(403, 'Só o diretor troca o engenheiro responsável.');
    await conferirResponsaveis(corpo.engenheiroId, corpo.encarregadoId, linha);

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
      // Regra do cronograma (plano 2026-11-11-15-05): data de etapa/atividade que mudou e ficou a mais de
      // 5 d.u. da baseline inicial exige justificativa. Conferido aqui para não depender da tela.
      const desvios = desviosParaJustificar(atual, corpo);
      if (desvios.length) {
        if (!justificativaAlteracao || justificativaAlteracao.length < 5) {
          throw new ErroHttp(400, `Alteração de prazo acima de ${LIMITE_JUSTIFICATIVA_DU} dias úteis da baseline inicial precisa de justificativa (${desvios.map((d) => d.codigo).join(', ')}).`);
        }
      }
      await gravarObra(tx, { ...corpo, revisao: travada.revisao }, { nova: false });
      if (desvios.length) {
        await inserirAlteracao(tx, corpo.id, { id: `alt-${randomUUID()}`, data: hojeServidor(), autorId: u.id, justificativa: justificativaAlteracao!, itens: desvios });
      }
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
      // Baseline inicial é fixa: mudanças de prazo vão para o histórico com justificativa (plano 2026-11-11-15-05).
      if (obra.baselines.length >= 1) throw new ErroHttp(400, 'A baseline inicial já existe e é fixa. Alterações de prazo são registradas com justificativa no cronograma.');
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
