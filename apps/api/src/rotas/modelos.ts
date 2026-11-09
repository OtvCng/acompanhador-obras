/** Modelos por tipo de obra: padrão do código (MODELOS) + edições salvas no banco. */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { MODELOS, type ModeloObra, type TipoObra } from '@obras/shared';
import { db, schema as s } from '../db';
import { ErroHttp, exigirPerfil, exigirUsuario } from '../auth/sessao';
import * as v from '../validacao';

async function modelosAtuais(): Promise<Record<TipoObra, ModeloObra>> {
  const salvos = await db.select().from(s.modelos);
  const r = JSON.parse(JSON.stringify(MODELOS)) as Record<TipoObra, ModeloObra>;
  for (const m of salvos) r[m.tipo] = m.dados as ModeloObra;
  return r;
}

export async function rotasModelos(app: FastifyInstance) {
  app.get('/api/modelos', async (req) => {
    exigirUsuario(req);
    return modelosAtuais();
  });

  app.put<{ Params: { tipo: string } }>('/api/modelos/:tipo', async (req) => {
    const u = exigirPerfil(req, 'diretor', 'engenheiro');
    const m = v.modelo.parse(req.body) as unknown as ModeloObra;
    if (m.tipo !== req.params.tipo) throw new ErroHttp(400, 'Tipo do modelo não confere.');
    // Pesos das atividades de cada etapa precisam somar 1 (100%), com folga de arredondamento.
    for (const etapa of m.etapasAtivas) {
      const ats = m.atividades.filter((a) => a.etapaCodigo === etapa);
      if (ats.length === 0) continue;
      const soma = ats.reduce((t, a) => t + a.pesoNaEtapa, 0);
      if (Math.abs(soma - 1) > 0.005) throw new ErroHttp(400, `Os pesos da etapa ${etapa} somam ${(soma * 100).toFixed(1)}%, precisam somar 100%.`);
    }
    await db.insert(s.modelos).values({ tipo: m.tipo, dados: m, atualizadoPor: u.id, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: s.modelos.tipo, set: { dados: m, atualizadoPor: u.id, atualizadoEm: new Date() } });
    return (await modelosAtuais())[m.tipo];
  });

  /** Volta um modelo ao padrão do código. */
  app.delete<{ Params: { tipo: string } }>('/api/modelos/:tipo', async (req) => {
    exigirPerfil(req, 'diretor', 'engenheiro');
    const tipo = v.tipoObra.parse(req.params.tipo);
    await db.delete(s.modelos).where(eq(s.modelos.tipo, tipo));
    return (await modelosAtuais())[tipo];
  });

  /** Volta todos os modelos ao padrão. */
  app.delete('/api/modelos', async (req) => {
    exigirPerfil(req, 'diretor', 'engenheiro');
    await db.delete(s.modelos);
    return modelosAtuais();
  });
}
